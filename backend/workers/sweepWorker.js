/**
 * Sweep worker — dedicated process for the corpus-hygiene interval jobs
 * (embed/skill backfill, ghost scan, prune, compaction, dedupe, board cap,
 * board refresh).
 *
 * These all used to run inline inside the API's app.listen callback,
 * unconditionally, regardless of RUN_CRON_INLINE. With everything —
 * request handling, Puppeteer, and up to 8 concurrent batch sweeps
 * against the same "ExternalJobs" table — crammed onto one 512MB web
 * dyno, the sweeps collided with each other (Postgres deadlocks / lock
 * timeouts) and the combined memory pressure pushed the process into
 * "JavaScript heap out of memory" crashes. Moving them here, into the
 * same standalone process as cronWorker.js, gets them off the request
 * path entirely.
 *
 * For local/dev convenience the API process can still embed these by
 * setting RUN_SWEEPS_INLINE=true (see server.js).
 */
require('dotenv').config();

// These sweeps run on independent timers but several write to the same
// "ExternalJobs" table, and previously ran concurrently — which is what
// produced "deadlock detected" / "canceling statement due to lock timeout"
// between siblings (e.g. ghost scan's UPDATE racing prune's DELETE), not
// just against web traffic. Chaining every tick through one promise queue
// means at most one sweep touches the DB at a time; a tick that fires while
// another is still running simply waits its turn instead of racing it.
let _queue = Promise.resolve();
function serialize(fn) {
  return () => {
    _queue = _queue.then(fn, fn);
    return _queue;
  };
}

function startSweeps() {
  // Self-healing job-embedding backfill. New jobs are embedded inline at
  // ingest, but those OpenAI calls can drop ("Premature close") and leave
  // jobs with embedding=NULL — which makes them invisible to semantic
  // RANKING (they still appear via the recency path, just unranked).
  // Deliberately gentle: one small OpenAI batch + a few single-row UPDATEs
  // per tick, single-flight. Disable with ENABLE_EMBED_BACKFILL=false.
  if (process.env.OPENAI_API_KEY && process.env.ENABLE_EMBED_BACKFILL !== 'false') {
    const { backfillMissingJobEmbeddings } = require('../services/jobEmbeddingService');
    const embedBatch = parseInt(process.env.EMBED_BACKFILL_BATCH || '50', 10);
    const embedIntervalMs = parseInt(process.env.EMBED_BACKFILL_INTERVAL_MS || '120000', 10);
    const embedTick = serialize(() => backfillMissingJobEmbeddings({ limit: embedBatch })
      .then(r => {
        if (r.success || r.failed) {
          console.log(`[EmbedBackfill] embedded ${r.success}, failed ${r.failed} (picked ${r.picked})`);
        }
      })
      .catch(err => console.warn('[EmbedBackfill] error:', err.message)));
    setTimeout(embedTick, 30000);
    setInterval(embedTick, embedIntervalMs);
    console.log(`[EmbedBackfill] ✓ enabled (batch=${embedBatch}, every ${Math.round(embedIntervalMs / 1000)}s)`);
  } else {
    console.log('[EmbedBackfill] disabled');
  }

  // Self-healing job-SKILL backfill. ExternalJob.skills powers the ?skills=
  // filter, the skill typeahead and the matched-skills badges, but it was
  // only ever populated by a fire-and-forget fan-out during sync whose
  // failures were swallowed and never retried — leaving ~90% of the corpus
  // with no skills at all and those features quietly non-functional.
  // Extraction now lives here instead: a small bounded batch, newest jobs
  // first, single-flight, resumable across restarts, with a circuit breaker
  // so an Anthropic outage backs off instead of hammering.
  //
  // Sizing note: this walks the whole corpus once, so the defaults are
  // deliberately gentle (25 jobs / 3 min ≈ 12k/day at roughly $0.0001 a job,
  // so a ~70k backlog clears in under a week for a few dollars). Raise
  // SKILL_BACKFILL_BATCH to drain faster. Disable with
  // ENABLE_SKILL_BACKFILL=false.
  if (process.env.ANTHROPIC_API_KEY && process.env.ENABLE_SKILL_BACKFILL !== 'false') {
    const { backfillMissingJobSkills } = require('../services/jobSkillExtractor');
    const skillBatch = parseInt(process.env.SKILL_BACKFILL_BATCH || '25', 10);
    const skillIntervalMs = parseInt(process.env.SKILL_BACKFILL_INTERVAL_MS || '180000', 10);
    const skillTick = serialize(() => backfillMissingJobSkills({ limit: skillBatch })
      .then(r => {
        if (r.attempted) {
          console.log(`[SkillBackfill] extracted ${r.extracted}/${r.attempted}`);
        }
      })
      .catch(err => console.warn('[SkillBackfill] error:', err.message)));
    // Offset from the embedding sweep so the two don't tick together and
    // stack API + DB load on the same second.
    setTimeout(skillTick, 75000);
    setInterval(skillTick, skillIntervalMs);
    console.log(`[SkillBackfill] ✓ enabled (batch=${skillBatch}, every ${Math.round(skillIntervalMs / 1000)}s)`);
  } else {
    console.log('[SkillBackfill] disabled');
  }

  // Ghost-job rescoring. Age is one of the inputs, so a listing's score
  // decays into staleness on its own — this is a recurring sweep, not a
  // one-shot backfill. Pure SQL (no model calls, no outbound HTTP), so it
  // is cheap; the batch is bounded and single-flight regardless.
  // Disable with ENABLE_GHOST_SCAN=false.
  if (process.env.ENABLE_GHOST_SCAN !== 'false') {
    const { scanGhostJobs } = require('../services/ghostJobDetector');
    const ghostIntervalMs = parseInt(process.env.GHOST_SCAN_INTERVAL_MS || '3600000', 10);
    const ghostTick = serialize(() => scanGhostJobs()
      .then(r => { if (r.scanned) console.log(`[GhostScan] rescored ${r.scanned}, flagged ${r.flagged}/${r.total}`); })
      .catch(err => console.warn('[GhostScan] error:', err.message)));
    setTimeout(ghostTick, 120000);
    setInterval(ghostTick, ghostIntervalMs);
    console.log(`[GhostScan] ✓ enabled (every ${Math.round(ghostIntervalMs / 60000)}m)`);
  } else {
    console.log('[GhostScan] disabled');
  }

  // Disk-reclaim: prune long-inactive ExternalJobs. Deactivated jobs (no
  // longer in any board's fetch) are never shown again but keep a row +
  // 1536-dim embedding + index entries forever, steadily bloating the DB
  // (a direct cause of the storage filling up). This sweeps a bounded batch
  // of jobs inactive for > PRUNE_INACTIVE_DAYS, skipping any saved/applied
  // ones (FK-safe). Gentle + single-flight; disable with
  // ENABLE_INACTIVE_JOB_PRUNE=false.
  if (process.env.ENABLE_INACTIVE_JOB_PRUNE !== 'false') {
    const { pruneStaleInactiveJobs } = require('../services/externalJobService');
    const pruneDays = parseInt(process.env.PRUNE_INACTIVE_DAYS || '14', 10);
    const pruneBatch = parseInt(process.env.PRUNE_INACTIVE_BATCH || '500', 10);
    const pruneIntervalMs = parseInt(process.env.PRUNE_INACTIVE_INTERVAL_MS || '900000', 10);
    const pruneTick = serialize(() => pruneStaleInactiveJobs({ days: pruneDays, limit: pruneBatch })
      .then(r => {
        if (r.deleted) console.log(`[InactivePrune] deleted ${r.deleted} stale inactive jobs (>${pruneDays}d)`);
      })
      .catch(err => console.warn('[InactivePrune] error:', err.message)));
    setTimeout(pruneTick, 90000);
    setInterval(pruneTick, pruneIntervalMs);
    console.log(`[InactivePrune] ✓ enabled (>${pruneDays}d inactive, batch=${pruneBatch}, every ${Math.round(pruneIntervalMs / 1000)}s)`);
  } else {
    console.log('[InactivePrune] disabled');
  }

  // Disk-reclaim, layer 2: compact heavy columns on OLD ExternalJob rows.
  // Nulls `metadata` (raw ATS JSON, never read back) and `descriptionHtml`
  // (HTML version of description; frontend falls back to plain `description`)
  // on rows older than COMPACT_OLD_JOBS_DAYS while keeping the row itself
  // discoverable. Both are TOASTed columns, so nulling them lets autovacuum
  // reclaim significant disk. Runs alongside the prune in a separate bounded
  // single-flight tick so neither blocks the other. Disable with
  // ENABLE_JOB_COMPACTION=false.
  if (process.env.ENABLE_JOB_COMPACTION !== 'false') {
    const { compactOldJobRows } = require('../services/externalJobService');
    const compactDays = parseInt(process.env.COMPACT_OLD_JOBS_DAYS || '7', 10);
    const compactBatch = parseInt(process.env.COMPACT_OLD_JOBS_BATCH || '500', 10);
    const compactIntervalMs = parseInt(process.env.COMPACT_OLD_JOBS_INTERVAL_MS || '600000', 10);
    const compactTick = serialize(() => compactOldJobRows({ days: compactDays, limit: compactBatch })
      .then(r => {
        if (r.updated) console.log(`[JobCompaction] compacted ${r.updated} jobs (>${compactDays}d, nulled descriptionHtml + metadata)`);
      })
      .catch(err => console.warn('[JobCompaction] error:', err.message)));
    setTimeout(compactTick, 120000);
    setInterval(compactTick, compactIntervalMs);
    console.log(`[JobCompaction] ✓ enabled (>${compactDays}d, batch=${compactBatch}, every ${Math.round(compactIntervalMs / 1000)}s)`);
  } else {
    console.log('[JobCompaction] disabled');
  }

  // Corpus hygiene: deactivate aggregator jobs that duplicate a direct-ATS
  // listing. The same role often arrives from both the company's own board
  // (greenhouse/lever/ashby — correct deep link) and an aggregator
  // (jsearch/adzuna/theirstack/… — noisier, worse link); nothing dedupes
  // across sources, so users saw it twice and sometimes clicked the worse
  // copy. This keeps the direct copy and hides the duplicate. Bounded +
  // single-flight; disable with ENABLE_JOB_DEDUPE=false.
  if (process.env.ENABLE_JOB_DEDUPE !== 'false') {
    const { deactivateAggregatorDuplicates } = require('../services/externalJobService');
    const dedupeBatch = parseInt(process.env.JOB_DEDUPE_BATCH || '500', 10);
    const dedupeIntervalMs = parseInt(process.env.JOB_DEDUPE_INTERVAL_MS || '600000', 10);
    const dedupeTick = serialize(() => deactivateAggregatorDuplicates({ limit: dedupeBatch })
      .then(r => {
        if (r.deactivated) console.log(`[JobDedupe] deactivated ${r.deactivated} aggregator jobs duplicating a direct-ATS listing`);
      })
      .catch(err => console.warn('[JobDedupe] error:', err.message)));
    setTimeout(dedupeTick, 150000);
    setInterval(dedupeTick, dedupeIntervalMs);
    console.log(`[JobDedupe] ✓ enabled (batch=${dedupeBatch}, every ${Math.round(dedupeIntervalMs / 1000)}s)`);
  } else {
    console.log('[JobDedupe] disabled');
  }

  // Self-balancing active-board cap. Weekly startup-board discovery
  // (cronWorker.js) has no ceiling and is the dominant driver of ongoing
  // DB growth — one discovery pass took the corpus from 145 to 702 boards.
  // Rather than throttle discovery (new legitimate companies should keep
  // flowing in), this retires the weakest EXISTING discovery-sourced
  // boards (fewest active jobs, most stale) whenever the active-board
  // count exceeds MAX_ACTIVE_BOARDS, making room. Hand-curated SEED_BOARDS
  // are never touched. Reversible via PUT /api/admin/ats-boards/:id.
  // Bounded + single-flight; disable with ENABLE_BOARD_CAP=false.
  if (process.env.ENABLE_BOARD_CAP !== 'false') {
    const { enforceActiveBoardCap } = require('../services/externalJobService');
    const maxBoards = parseInt(process.env.MAX_ACTIVE_BOARDS || '750', 10);
    const boardCapBatch = parseInt(process.env.BOARD_CAP_BATCH || '25', 10);
    const boardCapIntervalMs = parseInt(process.env.BOARD_CAP_INTERVAL_MS || '1800000', 10);
    const boardCapTick = serialize(() => enforceActiveBoardCap({ maxBoards, limit: boardCapBatch })
      .then(r => {
        if (r.retired) console.log(`[BoardCap] retired ${r.retired} weakest board(s) (${r.activeBoards} active > cap ${maxBoards})`);
      })
      .catch(err => console.warn('[BoardCap] error:', err.message)));
    setTimeout(boardCapTick, 180000);
    setInterval(boardCapTick, boardCapIntervalMs);
    console.log(`[BoardCap] ✓ enabled (max=${maxBoards}, batch=${boardCapBatch}, every ${Math.round(boardCapIntervalMs / 1000)}s)`);
  } else {
    console.log('[BoardCap] disabled');
  }

  // Scheduled stale-board refresh rotation. OPT-IN, DEFAULT OFF.
  // With no scheduled cron in this topology, board freshness (and the
  // Ashby postedAt backfill) otherwise only propagates when a user browses
  // a board's jobs and trips refreshIfStale. This rotation walks the few
  // most-stale boards on an interval so freshness heals without waiting on
  // traffic. It is GATED OFF by default because it adds continuous load to
  // the crash-prone managed Postgres — only flip ENABLE_BOARD_REFRESH=true
  // once the DB is upsized / stable. Deliberately gentle: a small batch of
  // the most-stale boards, synced one at a time, single-flight, yielding to
  // full sweeps and per-request refreshes.
  if (process.env.ENABLE_BOARD_REFRESH === 'true') {
    const { refreshStaleBoards } = require('../services/externalJobService');
    const boardBatch = parseInt(process.env.BOARD_REFRESH_BATCH || '3', 10);
    const boardIntervalMs = parseInt(process.env.BOARD_REFRESH_INTERVAL_MS || '300000', 10);
    const boardTick = serialize(() => refreshStaleBoards({ batch: boardBatch })
      .then(r => {
        if (r.synced || (r.results && r.results.length)) {
          console.log(`[BoardRefresh] synced ${r.synced || 0}/${(r.results || []).length} stale boards`
            + (r.skipped ? ` (skipped: ${r.skipped})` : ''));
        }
      })
      .catch(err => console.warn('[BoardRefresh] error:', err.message)));
    setTimeout(boardTick, 60000);
    setInterval(boardTick, boardIntervalMs);
    console.log(`[BoardRefresh] ✓ enabled (batch=${boardBatch}, every ${Math.round(boardIntervalMs / 1000)}s)`);
  } else {
    console.log('[BoardRefresh] disabled. Set ENABLE_BOARD_REFRESH=true to enable (only after DB is upsized).');
  }
}

module.exports = { startSweeps };

// Entry point when run directly (`node workers/sweepWorker.js`).
if (require.main === module) {
  console.log('[Sweeps:worker] Starting standalone sweep worker...');
  startSweeps();

  const shutdown = (sig) => {
    console.log(`[Sweeps:worker] Received ${sig}, exiting.`);
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
