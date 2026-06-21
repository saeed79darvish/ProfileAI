/**
 * Boot step: bootstrap startup ATS boards from the YC directory.
 *
 * Context: scripts/seedYcGreenhouseBoards.js discovers hundreds of startup
 * Greenhouse/Lever/Ashby boards, but it's a MANUAL script the git-push deploy
 * flow never runs. This boot step bootstraps that discovery automatically on
 * prod — but ONLY when the corpus of company boards is still small, so it runs
 * essentially once (first deploy after this ships) and then no-ops on every
 * subsequent boot. Ongoing refresh is handled by the weekly cron schedule
 * (workers/cronWorker.js), so this step intentionally stays a one-time
 * bootstrap and never re-crawls on routine restarts/deploys.
 *
 * Cost control:
 *   - GATED: skips entirely once we already have >= BOOTSTRAP_THRESHOLD
 *     greenhouse/lever/ashby boards (the discovery already ran, or enough were
 *     seeded). Avoids hammering hundreds of outbound HTTP probes on every boot.
 *   - LIMITED: probes at most BOOTSTRAP_LIMIT companies with low concurrency so
 *     it never saturates the web process. The weekly cron does the fuller sweep.
 *   - BACKGROUND: server.js runs this un-awaited; a crawl must never delay
 *     readiness or block boot, and a failure must never crash it.
 *
 * Run: node scripts/migrations/ensureStartupBoards.js
 */

const { Op } = require('sequelize');
const { ATSBoard } = require('../../models');
const { discoverYcBoards, discoverGetroBoards } = require('../../services/startupBoardDiscovery');

// Once we have at least this many company (greenhouse/lever/ashby) boards, the
// bootstrap is considered done and is skipped.
const BOOTSTRAP_THRESHOLD = 250;
// Max companies to probe during the boot bootstrap (the weekly cron is uncapped).
const BOOTSTRAP_LIMIT = 1500;
const BOOTSTRAP_CONCURRENCY = 5;
// Getro VC-network collection id range to scan during the boot bootstrap.
const GETRO_START_ID = 1;
const GETRO_END_ID = 400;

async function up() {
  const existing = await ATSBoard.count({
    where: { platform: { [Op.in]: ['greenhouse', 'lever', 'ashby'] } },
  });

  if (existing >= BOOTSTRAP_THRESHOLD) {
    console.log(`ensureStartupBoards: ${existing} company boards already present (>= ${BOOTSTRAP_THRESHOLD}) — skipping bootstrap.`);
    return;
  }

  console.log(`ensureStartupBoards: only ${existing} company boards — bootstrapping discovery…`);
  const startedAt = Date.now();

  // 1) Getro VC-portfolio networks (cheap, high-yield: one API per collection,
  //    no per-site probing). Mines Greenhouse/Lever/Ashby tokens from job URLs.
  let getro = { created: 0, counts: { greenhouse: 0, lever: 0, ashby: 0 }, networks: 0 };
  try {
    getro = await discoverGetroBoards({ startId: GETRO_START_ID, endId: GETRO_END_ID });
    console.log(
      `   Getro: scanned ${getro.networks} networks — created ${getro.created} boards ` +
      `(gh=${getro.counts.greenhouse}, lever=${getro.counts.lever}, ashby=${getro.counts.ashby}).`
    );
  } catch (err) {
    console.warn('   Getro discovery skipped:', err.message);
  }

  // 2) YC directory (per-company careers-page probe; slower, complementary).
  let yc = { created: 0, counts: { greenhouse: 0, lever: 0, ashby: 0 }, probed: 0 };
  try {
    yc = await discoverYcBoards({ limit: BOOTSTRAP_LIMIT, concurrency: BOOTSTRAP_CONCURRENCY });
    console.log(
      `   YC: probed ${yc.probed} sites — created ${yc.created} boards ` +
      `(gh=${yc.counts.greenhouse}, lever=${yc.counts.lever}, ashby=${yc.counts.ashby}).`
    );
  } catch (err) {
    console.warn('   YC discovery skipped:', err.message);
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
  console.log(
    `✅ ensureStartupBoards: created ${getro.created + yc.created} new boards in ${elapsed}s. ` +
    `The cron sweep will ingest their jobs within 15 min.`
  );
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ ensureStartupBoards failed:', err);
      process.exit(1);
    });
}

module.exports = { up };
