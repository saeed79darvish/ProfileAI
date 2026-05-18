/**
 * Prep worker · consumes applypilot:prep jobs.
 *
 * Mirrors submitWorker.js shape:
 *   - In-process: `mountPrepWorker()` is called from server.js.
 *   - Standalone: `node workers/prepWorker.js` for production scaling.
 *
 * Flow per job:
 *   1. Atomically claim the row (status pending|preparing|needs_attention
 *      → preparing, increment prepAttempts).
 *   2. Call service.prepareApplication(appId) — does the AI work.
 *   3. On success and payload.autoSubmitOnReady + config.approval='auto'
 *      → mark approved + enqueue submit.
 *   4. On error:
 *      - Transient (Claude overloaded, 529/503, network reset) AND under
 *        retry budget → throw so pg-boss reschedules with backoff.
 *      - Terminal OR retries exhausted → set needs_attention with the
 *        error message, send a notification, and ack the job.
 */
require('dotenv').config();
const { Op } = require('sequelize');

const { getBoss, shutdown, QUEUES, enqueue } = require('../lib/queue');
const { createNotification } = require('../services/notificationService');
const {
  ApplyPilotApplication,
  ApplyPilotConfig,
} = require('../models');
const service = require('../services/applyPilotService');

// pg-boss `retryLimit` covers the transient-error retries; this constant
// is the worker's own ceiling (covers re-enqueues from routes / retries
// that pg-boss already discarded). Once we cross this, we always
// terminate to needs_attention regardless of error class.
const MAX_PREP_ATTEMPTS = 3;

// Hard ceiling on prep operations per user per rolling 24h. The scout
// already respects `criteria.dailyLimit`, but manual creates, edits, and
// retries on needs_attention bypass that. This second ceiling prevents
// any path from burning unbounded AI spend for a single user.
//
// The cap is taken from `criteria.dailyLimit` (default 10) plus a safety
// buffer of 5 to allow retries / re-preps. It is a soft signal \u2014
// exceeding it does NOT fail prep, it just defers to needs_attention so
// the user has to acknowledge before more work is done.
const DAILY_PREP_BUFFER = 5;
const DEFAULT_DAILY_LIMIT = 10;

// Allowed source statuses we may transition into 'preparing'. Anything
// else means the row was rejected, already submitting, or already done —
// the prep worker should silently no-op.
const PREP_CLAIMABLE_STATUSES = ['pending', 'preparing', 'needs_attention'];

async function markPrepFailure(app, err) {
  app.status = 'needs_attention';
  app.errorMessage = String(err?.message || err || 'Preparation failed').slice(0, 2000);
  await app.save();
}

async function handleJob(job) {
  const appId = job.data?.appId;
  const autoSubmitOnReady = !!job.data?.autoSubmitOnReady;
  if (!appId) {
    console.warn('[prepWorker] job with no appId — ignoring');
    return;
  }

  console.log(`[prepWorker] picking up appId=${appId} (attempt ${job.retryCount ?? 0})`);

  const app = await ApplyPilotApplication.findByPk(appId);
  if (!app) {
    console.warn(`[prepWorker] appId=${appId} not found — ignoring`);
    return;
  }

  // Already past prep — nothing to do.
  if (['prepared', 'approved', 'submitting', 'submitted', 'rejected'].includes(app.status)) {
    console.log(`[prepWorker] skipping appId=${appId}, status=${app.status}`);
    return;
  }

  // Daily prep cap: count successful preps in the last 24h for this
  // user. If we're over the soft ceiling, mark needs_attention with a
  // clear reason. The user can acknowledge or extend dailyLimit before
  // re-prep is allowed.
  const cfg = await ApplyPilotConfig.findOne({ where: { userId: app.userId } });
  const dailyLimit = (cfg?.criteria?.dailyLimit ?? DEFAULT_DAILY_LIMIT) + DAILY_PREP_BUFFER;
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const preppedRecently = await ApplyPilotApplication.count({
    where: {
      userId: app.userId,
      preparedAt: { [Op.gte]: dayAgo },
    },
  });
  if (preppedRecently >= dailyLimit) {
    app.status = 'needs_attention';
    app.errorMessage = `Daily prep cap reached (${preppedRecently}/${dailyLimit} in last 24h). Increase dailyLimit in ApplyPilot settings to allow more, or wait for the cap to roll over.`;
    await app.save();
    console.log(`[prepWorker] daily cap hit for user=${app.userId} (${preppedRecently}/${dailyLimit}) \u2014 deferring appId=${appId}`);
    return;
  }

  // Atomic claim. If a concurrent worker picked this up or the user
  // rejected mid-flight, the update affects 0 rows and we bail.
  const now = new Date();
  const [updatedCount] = await ApplyPilotApplication.update(
    {
      status: 'preparing',
      prepAttempts: (app.prepAttempts || 0) + 1,
      lastPrepAttemptAt: now,
    },
    {
      where: {
        id: appId,
        status: { [Op.in]: PREP_CLAIMABLE_STATUSES },
      },
    },
  );
  if (!updatedCount) {
    console.log(`[prepWorker] status changed concurrently for appId=${appId}, skipping`);
    return;
  }
  await app.reload();

  try {
    await service.prepareApplication(appId);

    // Auto-approve + enqueue submit when the scout asked for it AND the
    // user's config opted into auto-mode. Other callers (edit, resolve)
    // pass autoSubmitOnReady=false so the user gets to review.
    if (autoSubmitOnReady) {
      const cfg = await ApplyPilotConfig.findOne({ where: { userId: app.userId } });
      if (cfg && cfg.approval === 'auto') {
        const fresh = await ApplyPilotApplication.findByPk(appId);
        if (fresh && fresh.status === 'prepared') {
          fresh.status = 'approved';
          fresh.approvedAt = new Date();
          await fresh.save();
          await enqueue(
            QUEUES.SUBMIT,
            { appId },
            { singletonKey: `submit:${appId}` },
          );
          console.log(`[prepWorker] ✓ appId=${appId} prepped + auto-enqueued for submit`);
          return;
        }
      }
    }

    console.log(`[prepWorker] ✓ appId=${appId} prepped`);
  } catch (err) {
    const transient = service.isTransientPrepError(err);
    const attempts = (app.prepAttempts || 0) + 0; // already incremented above
    const exhausted = attempts >= MAX_PREP_ATTEMPTS;

    console.warn(
      `[prepWorker] prep failed appId=${appId} (transient=${transient}, attempts=${attempts}/${MAX_PREP_ATTEMPTS}): ${err.message}`,
    );

    if (transient && !exhausted) {
      // Reset to 'pending' so the next retry can re-claim, then rethrow
      // to let pg-boss schedule with its own backoff.
      const fresh = await ApplyPilotApplication.findByPk(appId);
      if (fresh && fresh.status === 'preparing') {
        fresh.status = 'pending';
        fresh.errorMessage = `AI service temporarily unavailable — retrying. (${err.message || 'overloaded'})`;
        await fresh.save();
      }
      throw err;
    }

    // Terminal or exhausted — surface to the user.
    await markPrepFailure(app, transient
      ? new Error(`AI service unavailable after ${attempts} attempts. ${err.message || ''}`.trim())
      : err);

    try {
      await createNotification(
        app.userId,
        'agent_update',
        `Application prep paused: ${app.company || 'employer'}`,
        `We couldn't finish preparing your application for ${app.role || 'the position'} at ${app.company || 'the company'}. Open ApplyPilot to retry.`,
        { applicationId: app.id, updateType: 'needs_attention' },
      );
    } catch (notifyErr) {
      console.warn('[prepWorker] notification failed:', notifyErr.message);
    }
  }
}

async function mountPrepWorker() {
  const boss = await getBoss();
  if (typeof boss.createQueue === 'function') {
    try { await boss.createQueue(QUEUES.PREP); } catch (_) { /* already exists */ }
  }
  const workerId = await boss.work(
    QUEUES.PREP,
    { teamSize: 2, teamConcurrency: 1 },
    async (jobOrJobs) => {
      const jobs = Array.isArray(jobOrJobs) ? jobOrJobs : [jobOrJobs];
      for (const j of jobs) {
        await handleJob(j);
      }
    },
  );
  console.log(`[prepWorker] mounted on ${QUEUES.PREP} (workerId=${workerId})`);
  return async () => boss.offWork(workerId);
}

// ---- Standalone entrypoint: `node workers/prepWorker.js` -----
if (require.main === module) {
  (async () => {
    const { sequelize } = require('../models');
    await sequelize.authenticate();
    console.log('[prepWorker] standalone · DB connected');
    await mountPrepWorker();

    const stop = async () => {
      console.log('[prepWorker] shutting down…');
      await shutdown();
      await sequelize.close();
      process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  })().catch((err) => {
    console.error('[prepWorker] fatal boot error:', err);
    process.exit(1);
  });
}

module.exports = { mountPrepWorker, handleJob };
