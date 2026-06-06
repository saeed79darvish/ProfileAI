/**
 * Cron worker — dedicated process for scheduled jobs.
 *
 * In production this should run as a SEPARATE process (e.g. via
 * `npm run cron`) so it doesn't compete with the API server for CPU /
 * memory and so multi-instance API deploys don't duplicate scheduled
 * work (every instance would otherwise fire the same cron).
 *
 * For local/dev convenience the API process can still embed these cron
 * tasks by setting RUN_CRON_INLINE=true (see server.js).
 */
require('dotenv').config();

const cron = require('node-cron');

function startCron({ inline = false } = {}) {
  const tag = inline ? '[Cron:inline]' : '[Cron:worker]';
  const enableExternalJobsCron =
    process.env.ENABLE_EXTERNAL_JOBS_CRON === 'true'
    || process.env.NODE_ENV === 'production';
  const enableApplyPilotScoutCron =
    process.env.ENABLE_APPLYPILOT_SCOUT_CRON === 'true'
    || process.env.NODE_ENV === 'production';
  const enableJobDigestCron =
    process.env.ENABLE_JOB_DIGEST_CRON === 'true'
    || process.env.NODE_ENV === 'production';

  if (!enableExternalJobsCron && !enableApplyPilotScoutCron && !enableJobDigestCron) {
    console.warn(`${tag} ⚠️  No cron tasks enabled. Set ENABLE_EXTERNAL_JOBS_CRON=true, ENABLE_APPLYPILOT_SCOUT_CRON=true, or ENABLE_JOB_DIGEST_CRON=true.`);
    return;
  }

  if (enableExternalJobsCron) {
    const { syncAllBoards } = require('../services/externalJobService');
    cron.schedule('*/15 * * * *', () => {
      console.log(`${tag} Running external jobs sync...`);
      syncAllBoards().catch(err => console.error(`${tag} External jobs sync error:`, err.message));
    });
    // Initial run after a short delay so the DB pool warms up first.
    setTimeout(() => {
      syncAllBoards().catch(err => console.error(`${tag} Initial external jobs sync error:`, err.message));
    }, 10000);
    console.log(`${tag} ✓ External jobs sync scheduled (every 15min)`);
  } else {
    console.log(`${tag} External jobs sync disabled`);
  }

  if (enableApplyPilotScoutCron) {
    const { runScout } = require('../services/applyPilotScout');
    cron.schedule('*/10 * * * *', () => {
      console.log(`${tag} Running ApplyPilot scout...`);
      runScout().catch(err => console.error(`${tag} ApplyPilot scout error:`, err.message));
    });
    console.log(`${tag} ✓ ApplyPilot scout scheduled (every 10min)`);
  } else {
    console.log(`${tag} ApplyPilot scout disabled`);
  }

  if (enableJobDigestCron) {
    const { runDailyJobDigest } = require('../services/jobDigestService');
    // Daily at 08:00 (server timezone). Override with JOB_DIGEST_CRON if needed.
    const schedule = process.env.JOB_DIGEST_CRON || '0 8 * * *';
    cron.schedule(schedule, () => {
      console.log(`${tag} Running daily job-match digest...`);
      runDailyJobDigest().catch(err => console.error(`${tag} Job digest error:`, err.message));
    }, { recoverMissedExecutions: false });
    console.log(`${tag} ✓ Daily job-match digest scheduled (${schedule})`);
  } else {
    console.log(`${tag} Daily job-match digest disabled`);
  }
}

module.exports = { startCron };

// Entry point when run directly (`node workers/cronWorker.js` / `npm run cron`).
if (require.main === module) {
  console.log('[Cron:worker] Starting standalone cron worker...');
  startCron({ inline: false });

  const shutdown = (sig) => {
    console.log(`[Cron:worker] Received ${sig}, exiting.`);
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
