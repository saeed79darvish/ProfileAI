/**
 * Ghost-job detection.
 *
 * A "ghost job" is a real company's real-looking posting that nobody is
 * actually hiring for: an evergreen pipeline ad, a role left up long after it
 * was filled, or a listing whose date is refreshed indefinitely to keep it near
 * the top of job boards. This is a different problem from the fraud detection in
 * jobScamDetector.js — that reads the TEXT for scam patterns and catches
 * criminals. Ghost jobs are posted by legitimate employers and read perfectly
 * normally, so text analysis cannot find them. Only behaviour over time can.
 *
 * SIGNALS, AND WHY THESE ONES
 * ---------------------------
 * Measured against the live corpus before choosing:
 *
 *   Continuous-listing age — createdAt genuinely means "first seen by us", so
 *     days-live is exact rather than inferred. Real roles fill; a listing alive
 *     for months is the single strongest indicator.
 *
 *   Re-stamp gap — postedAt moving well past the date we first saw the row is
 *     the textbook evergreen pattern: the source keeps re-dating a posting it
 *     never takes down. ~30% of rows carried a postedAt ahead of first sighting
 *     when effectivePostedAt was introduced.
 *
 *   Evergreen language — "talent pool", "general application", "future
 *     openings", "keep your resume on file". These are not vacancies at all and
 *     say so out loud. 239 postings matched on the corpus. Weighted higher in
 *     the TITLE than the description, because a description may mention a
 *     talent pool in passing while a title that says it IS the whole posting.
 *
 * DELIBERATELY NOT USED: raw posting volume per company. Anduril has 2,185 open
 * roles in this corpus and SpaceX 1,703 — those are real. Penalising
 * high-volume employers would be a false-positive machine. Only a per-company
 * staleness RATIO would carry signal, and that needs the ingest fingerprint work
 * before it can be computed reliably.
 *
 * SCORES, NEVER DELETES
 * ---------------------
 * A slow-to-fill senior role looks identical to a ghost from the outside, and a
 * candidate cannot tell us when we guessed wrong. So the score demotes a
 * listing in ranking and surfaces an explanation; it never removes it.
 */

const sequelize = require('../config/database');

const WRITE_TIMEOUT_MS = parseInt(process.env.SYNC_WRITE_TIMEOUT_MS || '120000', 10);
// 400, not 5000. Each row evaluates the score plus a correlated subquery with
// seven UNION ALL branches to build its reasons, so a 5000-row batch is ~35k
// subquery evaluations in ONE statement. That completed in ~6s on a dev machine
// but production runs 5x the rows on a 256MB instance with far less cache, and
// a batch that overruns the statement timeout aborts the whole sweep — leaving
// every row unscored, which is exactly what happened on first deploy. Smaller
// batches cost a few more round trips and make a stall impossible.
const BATCH_SIZE = parseInt(process.env.GHOST_SCAN_BATCH || '400', 10);
const MAX_BATCHES = parseInt(process.env.GHOST_SCAN_MAX_BATCHES || '400', 10);
// Age is part of the score, so a row's score goes stale on its own and must be
// recomputed periodically — this is not a one-shot backfill.
const RECHECK_AFTER_DAYS = parseInt(process.env.GHOST_RECHECK_DAYS || '3', 10);

/** Score at or above which we treat a listing as probably not a live vacancy. */
const GHOST_THRESHOLD = parseInt(process.env.GHOST_THRESHOLD || '50', 10);

// Phrases that mean "this is not a specific open role". Kept narrow on purpose:
// each of these is an explicit statement, not an inference.
const EVERGREEN_TITLE_SQL = `(
  ej.title ILIKE '%general application%' OR
  ej.title ILIKE '%talent pool%' OR
  ej.title ILIKE '%talent community%' OR
  ej.title ILIKE '%talent network%' OR
  ej.title ILIKE '%future opportunit%' OR
  ej.title ILIKE '%speculative application%' OR
  ej.title ILIKE '%expression of interest%' OR
  ej.title ILIKE '%open application%'
)`;
const EVERGREEN_BODY_SQL = `(
  ej.description ILIKE '%talent pool%' OR
  ej.description ILIKE '%talent community%' OR
  ej.description ILIKE '%always accepting applications%' OR
  ej.description ILIKE '%keep your resume on file%' OR
  ej.description ILIKE '%future openings%' OR
  ej.description ILIKE '%no specific opening%'
)`;

// Component weights. Age ramps rather than steps so a listing degrades
// gradually instead of flipping state on an arbitrary day boundary.
const AGE_SQL = `
  CASE
    WHEN ej."createdAt" > NOW() - INTERVAL '30 days'  THEN 0
    WHEN ej."createdAt" > NOW() - INTERVAL '60 days'  THEN 5
    WHEN ej."createdAt" > NOW() - INTERVAL '90 days'  THEN 15
    WHEN ej."createdAt" > NOW() - INTERVAL '120 days' THEN 25
    ELSE 40
  END`;
const RESTAMP_SQL = `
  CASE
    WHEN ej."postedAt" IS NULL THEN 0
    WHEN ej."postedAt" > ej."createdAt" + INTERVAL '30 days' THEN 25
    WHEN ej."postedAt" > ej."createdAt" + INTERVAL '7 days'  THEN 10
    ELSE 0
  END`;
const EVERGREEN_SQL = `
  CASE
    WHEN ${EVERGREEN_TITLE_SQL} THEN 55
    WHEN ${EVERGREEN_BODY_SQL}  THEN 30
    ELSE 0
  END`;

const SCORE_SQL = `LEAST(100, (${AGE_SQL}) + (${RESTAMP_SQL}) + (${EVERGREEN_SQL}))`;

// Reasons are built alongside the score so a flag is always explainable.
const REASONS_SQL = `(
  SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
    SELECT 'Listed for over 120 days' AS r WHERE ej."createdAt" <= NOW() - INTERVAL '120 days'
    UNION ALL
    SELECT 'Listed for over 90 days' WHERE ej."createdAt" <= NOW() - INTERVAL '90 days'
                                       AND ej."createdAt" > NOW() - INTERVAL '120 days'
    UNION ALL
    SELECT 'Listed for over 60 days' WHERE ej."createdAt" <= NOW() - INTERVAL '60 days'
                                       AND ej."createdAt" > NOW() - INTERVAL '90 days'
    UNION ALL
    SELECT 'Posting date repeatedly refreshed' WHERE ej."postedAt" IS NOT NULL
                                       AND ej."postedAt" > ej."createdAt" + INTERVAL '30 days'
    UNION ALL
    -- The moderate re-stamp band contributes 10 points, and without this row a
    -- listing could cross the flag threshold (40 age + 10 restamp) carrying only
    -- an age reason — a flag whose stated reasons do not account for it. Every
    -- component that moves the score must be able to explain itself.
    SELECT 'Posting date refreshed after we first saw it' WHERE ej."postedAt" IS NOT NULL
                                       AND ej."postedAt" > ej."createdAt" + INTERVAL '7 days'
                                       AND ej."postedAt" <= ej."createdAt" + INTERVAL '30 days'
    UNION ALL
    SELECT 'Pipeline posting, not a specific role' WHERE ${EVERGREEN_TITLE_SQL}
    UNION ALL
    SELECT 'Mentions a talent pool rather than an opening' WHERE NOT (${EVERGREEN_TITLE_SQL})
                                       AND ${EVERGREEN_BODY_SQL}
  ) s
)`;

let _inFlight = false;
// Last outcome, surfaced on the admin health endpoint. A sweep that fails only
// into a log line is undiagnosable on a platform where you cannot tail logs —
// the first production run failed exactly that way and looked identical to
// "the corpus is young and nothing qualifies".
let _lastRun = { at: null, scanned: 0, error: null };
function getLastRun() { return { ..._lastRun }; }

/**
 * Rescore a bounded batch of active listings whose score is missing or stale.
 * Pure SQL — no model calls, no outbound HTTP — so it is cheap enough to run
 * often on a small instance.
 */
async function scanGhostJobs({ limit = BATCH_SIZE } = {}) {
  if (_inFlight) return { scanned: 0, flagged: 0, skipped: 'in-flight' };
  _inFlight = true;
  try {
    let scanned = 0;
    let batches = 0;
    for (; batches < MAX_BATCHES; batches++) {
      const updated = await sequelize.transaction(async (t) => {
        await sequelize.query(`SET LOCAL statement_timeout = ${WRITE_TIMEOUT_MS}`, { transaction: t });
        const [rows] = await sequelize.query(
          // Select by WHAT WOULD CHANGE, not by when we last looked.
          //
          // Selecting on ghostCheckedAt meant every pass rewrote every row —
          // ~72k in production — and each of those UPDATEs fires the
          // effectivePostedAt trigger and touches every index on the table,
          // for a score that is identical to the one already stored. That is
          // pure write amplification on a small instance: bloat, autovacuum
          // pressure and evicted cache, which is what made even trivial
          // aggregate queries take seconds.
          //
          // Comparing the computed score to the stored one is a read. Rows
          // whose score has not moved cost nothing beyond that read, so after
          // the first pass a sweep writes only the handful of rows that
          // actually crossed an age boundary.
          `WITH batch AS (
             SELECT ej.id FROM "ExternalJobs" ej
              WHERE ej."isActive" = true
                AND ej."ghostScore" IS DISTINCT FROM ${SCORE_SQL}
              LIMIT ${limit}
           )
           UPDATE "ExternalJobs" ej
              SET "ghostScore"    = ${SCORE_SQL},
                  "ghostReasons"  = ${REASONS_SQL},
                  "ghostCheckedAt" = NOW()
             FROM batch b
            WHERE ej.id = b.id
           RETURNING ej.id`,
          { transaction: t }
        );
        return Array.isArray(rows) ? rows.length : 0;
      });
      if (updated === 0) break;
      scanned += updated;
    }
    _lastRun = { at: new Date().toISOString(), scanned, error: null };

    const [[agg]] = await sequelize.query(
      `SELECT COUNT(*) FILTER (WHERE "ghostScore" >= ${GHOST_THRESHOLD})::int flagged,
              COUNT(*)::int total
         FROM "ExternalJobs" WHERE "isActive" = true`,
      { type: sequelize.constructor.QueryTypes.SELECT }
    ).then((r) => [r]);

    return { scanned, flagged: agg.flagged, total: agg.total };
  } catch (err) {
    // Surface the real cause. `err.message` alone hides the useful part of a
    // Postgres error, so keep the driver's detail too.
    _lastRun = {
      at: new Date().toISOString(),
      scanned: 0,
      error: `${err.message}${err.parent ? ` | ${err.parent.message}` : ''}`,
    };
    console.error('[GhostScan] failed:', _lastRun.error);
    throw err;
  } finally {
    _inFlight = false;
  }
}

/** Corpus-level snapshot for the admin health endpoint. */
async function getGhostStats() {
  const [row] = await sequelize.query(
    `SELECT COUNT(*)::int total,
            COUNT(*) FILTER (WHERE "ghostScore" >= ${GHOST_THRESHOLD})::int flagged,
            COUNT(*) FILTER (WHERE "ghostScore" BETWEEN 25 AND ${GHOST_THRESHOLD - 1})::int aging,
            COUNT(*) FILTER (WHERE "ghostCheckedAt" IS NULL)::int unscored
       FROM "ExternalJobs" WHERE "isActive" = true`,
    { type: sequelize.constructor.QueryTypes.SELECT }
  );
  return row;
}

module.exports = { scanGhostJobs, getGhostStats, getLastRun, GHOST_THRESHOLD, SCORE_SQL };
