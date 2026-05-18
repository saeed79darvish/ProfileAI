/**
 * Submit worker · consumes applypilot:submit jobs.
 *
 * Can run two ways:
 *   - In-process: `mountSubmitWorker()` is called from server.js and
 *     shares the API server's pg-boss instance. Good for dev.
 *   - Standalone: `npm run worker` boots this file directly so the
 *     worker can scale separately in production.
 *
 * Flow per job:
 *   1. Load the ApplyPilotApplication row + its ExternalJob (for applyUrl)
 *     + the candidate's Profile, User, and TrainingMemory rows.
 *   2. Render and upload the tailored resume PDF.
 *   3. Pick the right ATS adapter based on applyUrl.
 *   4. Run adapter.submit(ctx) → success | needsHuman | fail.
 *   5. Persist status + artifacts back onto the row.
 */
require('dotenv').config();
const { Op } = require('sequelize');

const { getBoss, shutdown, QUEUES } = require('../lib/queue');
const { createNotification } = require('../services/notificationService');
const {
  ApplyPilotApplication,
  ApplyPilotConfig,
  ExternalJob,
  Job,
  Profile,
  User,
  ApplyPilotTrainingMemory,
} = require('../models');
const { selectAdapter } = require('../services/ats');
const { buildAndUpload } = require('../services/resumePdf');
const { syncTailoredProfileFromApplication } = require('../services/applyPilotService');
const { resolveAndBackfillApplyUrl } = require('../services/applyPilotUrlResolver');
const {
  getDecryptedCredential,
  getDecryptedCredentialById,
  markCredentialStatus,
} = require('../services/applyPilotCredentialService');

const MAX_ATTEMPTS = 3;
const CREDENTIAL_REQUIRED_PROVIDERS = new Set([
  'workday',
  'taleo',
  'icims',
  'custom',
]);

function normalizeProviderName(name) {
  const raw = String(name || '').toLowerCase();
  if (!raw) return null;
  if (raw.includes('greenhouse')) return 'greenhouse';
  if (raw.includes('lever')) return 'lever';
  if (raw.includes('ashby')) return 'ashby';
  if (raw.includes('workable')) return 'workable';
  if (raw.includes('smartrecruiters')) return 'smartrecruiters';
  if (raw.includes('workday')) return 'workday';
  if (raw.includes('amazon')) return 'amazon';
  if (raw.includes('taleo')) return 'taleo';
  if (raw.includes('icims')) return 'icims';
  if (raw.includes('custom')) return 'custom';
  return raw;
}

function isCredentialError(err) {
  const text = String(err?.message || '').toLowerCase();
  return (
    text.includes('unauthorized')
    || text.includes('invalid api key')
    || text.includes('invalid credential')
    || text.includes('forbidden')
    || text.includes('authentication')
    || text.includes('login failed')
  );
}

async function loadApplicationContext(appId) {
  const app = await ApplyPilotApplication.findByPk(appId);
  if (!app) throw new Error(`[submitWorker] application ${appId} not found`);

  // Resolve applyUrl — harvested jobs have it directly, internal Job
  // rows currently don't (so those can't be auto-submitted in Phase 1).
  const applyUrl = await resolveAndBackfillApplyUrl(app, { ExternalJob, Job });
  if (app.changed()) await app.save();

  const [user, profile, memory, pilotConfig] = await Promise.all([
    User.findByPk(app.userId, { attributes: ['id', 'firstName', 'lastName', 'email'] }),
    Profile.findOne({ where: { userId: app.userId } }),
    ApplyPilotTrainingMemory.findAll({ where: { userId: app.userId } }),
    ApplyPilotConfig.findOne({ where: { userId: app.userId } }),
  ]);

  // Load the underlying job row (ExternalJob for harvested postings,
  // internal Job otherwise) so adapters can hand the JD + requirements
  // to the field-mapping LLM. Without this, custom long-form questions
  // ("describe a project where you applied X") have no JD context and
  // tend to be skipped.
  let jobRow = null;
  try {
    if (app.externalJobId) jobRow = await ExternalJob.findByPk(app.externalJobId);
    else if (app.jobId) jobRow = await Job.findByPk(app.jobId);
  } catch (err) {
    console.warn('[submitWorker] job load failed (non-blocking):', err.message);
  }

  const demographics = pilotConfig?.demographics || {};

  return { app, applyUrl, user, profile, memory, demographics, job: jobRow };
}

async function markFailure(app, err, { needsHuman = false } = {}) {
  app.status = needsHuman ? 'needs_attention' : 'failed';
  app.submissionError = String(err?.message || err).slice(0, 2000);
  if (err?.blockers) {
    app.submissionReceipt = {
      ok: false,
      needsHuman: true,
      blockers: err.blockers,
      at: new Date().toISOString(),
    };
  }
  // If the adapter attached screenshots to the error (Puppeteer path),
  // persist them so the Review tab can show what the page looked like
  // when submission blew up / paused.
  if (Array.isArray(err?.screenshots) && err.screenshots.length) {
    const existing = Array.isArray(app.submissionScreenshotUrls) ? app.submissionScreenshotUrls : [];
    app.submissionScreenshotUrls = [...existing, ...err.screenshots];
  }
  await app.save();
}

async function handleJob(job) {
  const appId = job.data?.appId;
  if (!appId) {
    console.warn('[submitWorker] job with no appId — ignoring');
    return;
  }

  console.log(`[submitWorker] picking up appId=${appId} (attempt ${job.retryCount ?? 0})`);

  let ctx;
  try {
    ctx = await loadApplicationContext(appId);
  } catch (err) {
    console.error('[submitWorker] load failed:', err.message);
    return; // row missing — nothing to mark
  }

  const { app, applyUrl, user, profile, memory, demographics, job: jobRow } = ctx;

  // Ignore if state changed since enqueue (e.g. user rejected after approve).
  if (!['approved', 'submitting'].includes(app.status)) {
    console.log(`[submitWorker] skipping appId=${appId}, status=${app.status}`);
    return;
  }

  // Claim this app atomically so a concurrent reject/reopen doesn't get
  // overwritten by a stale instance save.
  const now = new Date();
  const [updatedCount] = await ApplyPilotApplication.update(
    {
      status: 'submitting',
      submitAttempts: (app.submitAttempts || 0) + 1,
      lastSubmitAttemptAt: now,
    },
    {
      where: {
        id: app.id,
        status: { [Op.in]: ['approved', 'submitting'] },
      },
    },
  );
  if (!updatedCount) {
    console.log(`[submitWorker] status changed concurrently for appId=${appId}, skipping`);
    return;
  }
  await app.reload();

  // No URL → can't auto-submit, but we still produce the tailored PDF
  // so the candidate can apply manually.
  if (!applyUrl) {
    await markFailure(app, {
      message: 'No applyUrl on the underlying job — candidate must submit manually.',
    }, { needsHuman: true });
    return;
  }

  const adapter = selectAdapter(applyUrl);
  if (!adapter) {
    await markFailure(app, {
      message: `No ATS adapter for ${applyUrl}. Needs Phase 2/3 support.`,
    }, { needsHuman: true });
    app.atsProvider = 'generic-unsupported';
    await app.save();
    return;
  }
  app.atsProvider = adapter.name;
  await app.save();
  console.log(
    `[submitWorker] appId=${appId} adapter=${adapter.name} url=${applyUrl}`,
  );
  const provider = normalizeProviderName(app.atsProvider);
  // Prefer the credential pinned to the application (set when the user
  // explicitly chose an account at approve time). Fall back to a
  // provider-scoped lookup which picks the most-recently-updated active
  // credential and logs a warning if multiple match.
  let credential = null;
  if (provider && CREDENTIAL_REQUIRED_PROVIDERS.has(provider)) {
    if (app.credentialId) {
      credential = await getDecryptedCredentialById({
        userId: app.userId,
        credentialId: app.credentialId,
      });
    }
    if (!credential) {
      credential = await getDecryptedCredential({ userId: app.userId, provider });
    }
  }

  // Some providers generally require an authenticated session or
  // account credentials before auto-submit can proceed.
  if (provider && CREDENTIAL_REQUIRED_PROVIDERS.has(provider) && !credential) {
    await markFailure(app, {
      message: `Missing ${provider} credentials. Add credentials in ApplyPilot settings and retry.`,
      needsHuman: true,
      blockers: [{
        field: { label: `${provider} credentials`, rawName: 'credentials' },
        reason: 'missing_credentials',
      }],
    }, { needsHuman: true });
    return;
  }

  // Render + upload the resume PDF. Buffer is needed for the multipart
  // POST; URL is stored so the UI can show "Resume used".
  let resumePdfBuffer, resumeFileName, submittedPdfUrl;
  try {
    const out = await buildAndUpload(app);
    resumePdfBuffer = out.buffer;
    resumeFileName = out.fileName;
    submittedPdfUrl = out.url;
    if (submittedPdfUrl) {
      app.submittedPdfUrl = submittedPdfUrl;
      await app.save();
    }
  } catch (err) {
    console.error('[submitWorker] resume render failed:', err.message);
    await markFailure(app, err);
    if ((app.submitAttempts || 0) >= MAX_ATTEMPTS) return;
    throw err; // let pg-boss retry
  }

  // Fire the adapter.
  try {
    // One-shot verification code (e.g. Greenhouse's 8-char email gate).
    // Stashed by the resolve route. Pass it to the adapter and clear it
    // so it isn't reused by accident on subsequent retries.
    const verificationCode = app.submissionReceipt?.pendingVerificationCode || null;
    if (verificationCode) {
      const cleared = { ...(app.submissionReceipt || {}) };
      delete cleared.pendingVerificationCode;
      delete cleared.pendingVerificationCodeAt;
      app.submissionReceipt = cleared;
      await app.save();
    }

    const receipt = await adapter.submit({
      app,
      applyUrl,
      profile,
      user,
      memory,
      demographics,
      job: jobRow,
      credential,
      resumePdfBuffer,
      resumeFileName,
      verificationCode,
    });
    // Cancel-during-submit guard. The user may have hit Reject while
    // the adapter was mid-POST. Re-fetch the row's authoritative status
    // before claiming success — if it's `rejected`, leave the rejection
    // intact but PRESERVE the receipt as evidence: the ATS already
    // accepted the application even though the user changed their mind.
    // We never silently drop proof of submission.
    const fresh = await ApplyPilotApplication.findByPk(appId);
    if (fresh && fresh.status === 'rejected') {
      console.warn(
        `[submitWorker] appId=${appId} rejected mid-submit BUT ATS accepted — preserving receipt as evidence (status stays rejected)`,
      );
      // Stamp the receipt with a clear flag so the UI / downstream code
      // can surface "this was actually sent despite the reject".
      fresh.submissionReceipt = {
        ...(receipt || {}),
        submittedDespiteReject: true,
        submittedAt: new Date().toISOString(),
      };
      fresh.submittedAt = new Date();
      if (Array.isArray(receipt?.screenshots) && receipt.screenshots.length) {
        fresh.submissionScreenshotUrls = receipt.screenshots;
      }
      await fresh.save();

      // Notify the user — they need to know the application went through
      // so they can withdraw it from the employer's side if needed.
      await createNotification(
        app.userId,
        'agent_update',
        `Heads up: ${app.company || 'employer'} application was sent`,
        `Your application for ${app.role || 'the position'} at ${app.company || 'the company'} was already submitted to the employer before you rejected it. You may want to withdraw it directly with the employer.`,
        { applicationId: app.id, updateType: 'submitted_despite_reject' },
      );
      return;
    }
    app.status = 'submitted';
    app.submittedAt = new Date();
    app.submissionReceipt = receipt;
    app.submissionError = null;
    // Persist ordered screenshot timeline when the Puppeteer adapter
    // produced one. API-based adapter returns no screenshots, so this
    // is a no-op for the fast path.
    if (Array.isArray(receipt?.screenshots) && receipt.screenshots.length) {
      app.submissionScreenshotUrls = receipt.screenshots;
    }
    await app.save();

    if (provider && credential) {
      await markCredentialStatus({ userId: app.userId, provider, ok: true });
    }

    // Keep Profile-page provenance accurate (submitted timestamp/status).
    try {
      await syncTailoredProfileFromApplication({
        app,
        profile,
        tailored: app.tailoredResume || {},
        job: null,
      });
    } catch (syncErr) {
      console.warn('[submitWorker] TailoredProfile re-sync failed:', syncErr.message);
    }

    console.log(`[submitWorker] ✓ submitted appId=${appId} via ${adapter.name}`);

    // Notify user of successful submission
    await createNotification(
      app.userId,
      'agent_completed',
      `Application sent to ${app.company || 'employer'}`,
      `Your application for ${app.role || 'the position'} at ${app.company || 'the company'} was submitted successfully.`,
      { applicationId: app.id, updateType: 'submitted' },
    );
  } catch (err) {
    console.warn(`[submitWorker] submit failed appId=${appId}:`, err.message);
    const credentialFailure = isCredentialError(err);
    if (provider && credential && credentialFailure) {
      await markCredentialStatus({ userId: app.userId, provider, ok: false, error: err.message });
    }

    // Anti-bot / verification gate: auto-submit is impossible for this
    // posting. Mark the application as rejected (out of the auto-pilot
    // queue) and tell the user to apply manually via the Chrome extension.
    if (err.useChromeExtension || err.manualReviewRequired) {
      app.status = 'rejected';
      app.submissionError = String(err?.message || err).slice(0, 2000);
      app.submissionReceipt = {
        ok: false,
        manualApplyRequired: true,
        reason: 'anti_bot_verification_gate',
        provider: 'greenhouse',
        applyUrl,
        at: new Date().toISOString(),
      };
      if (Array.isArray(err.screenshots) && err.screenshots.length) {
        const existing = Array.isArray(app.submissionScreenshotUrls) ? app.submissionScreenshotUrls : [];
        app.submissionScreenshotUrls = [...existing, ...err.screenshots];
      }
      await app.save();

      await createNotification(
        app.userId,
        'agent_update',
        `Apply manually: ${app.company || 'employer'}`,
        `${app.role || 'This role'} at ${app.company || 'the company'} is a strong match, but the employer's site requires email verification that we can't complete automatically. Open the ApplyPilot Chrome extension on the job page to finish applying — it'll take ~30 seconds.`,
        { applicationId: app.id, updateType: 'manual_apply_required', applyUrl },
      );
      return; // do NOT retry, do NOT bubble — terminal state.
    }

    await markFailure(app, err, { needsHuman: !!err.needsHuman || credentialFailure });

    // Notify user of the failure / attention needed. Skip for the known
    // "no adapter yet" case — it's a product limitation, not a blocker the
    // user can act on. The row still shows in the Needs attention tab.
    if ((err.needsHuman || credentialFailure) && !err.unsupportedAts) {
      await createNotification(
        app.userId,
        'agent_update',
        `Action needed: ${app.company || 'employer'}`,
        `Your application for ${app.role || 'the position'} at ${app.company || 'the company'} needs your input before it can be submitted.`,
        { applicationId: app.id, updateType: 'needs_attention' },
      );
    } else if ((app.submitAttempts || 0) >= MAX_ATTEMPTS) {
      await createNotification(
        app.userId,
        'agent_update',
        `Submission failed: ${app.company || 'employer'}`,
        `Could not submit your application for ${app.role || 'the position'} at ${app.company || 'the company'} after ${MAX_ATTEMPTS} attempts. ${err.message || ''}`.trim(),
        { applicationId: app.id, updateType: 'failed' },
      );
    }

    // Only retry true errors (not needs-human blockers).
    if (!err.needsHuman && !credentialFailure && (app.submitAttempts || 0) < MAX_ATTEMPTS) {
      throw err;
    }
  }
}

/**
 * Mount the worker onto the shared pg-boss instance. Call from server.js.
 * Returns an unsubscribe function for graceful shutdown.
 */
async function mountSubmitWorker() {
  const boss = await getBoss();
  // Ensure the queue exists (pg-boss v10 requires explicit creation).
  if (typeof boss.createQueue === 'function') {
    try { await boss.createQueue(QUEUES.SUBMIT); } catch (_) { /* already exists */ }
  }
  const workerId = await boss.work(
    QUEUES.SUBMIT,
    { teamSize: 2, teamConcurrency: 1 },
    async (jobOrJobs) => {
      // pg-boss v10 passes an array; v9 passes a single job. Handle both.
      const jobs = Array.isArray(jobOrJobs) ? jobOrJobs : [jobOrJobs];
      for (const j of jobs) {
        try {
          await handleJob(j);
        } catch (err) {
          // Let pg-boss record the failure so retry/backoff kicks in.
          throw err;
        }
      }
    }
  );
  console.log(`[submitWorker] mounted on ${QUEUES.SUBMIT} (workerId=${workerId})`);
  return async () => boss.offWork(workerId);
}

// ---- Standalone entrypoint: `node workers/submitWorker.js` -----
if (require.main === module) {
  (async () => {
    // Connect Sequelize so models are usable. In dev server.js already
    // ran sync({ alter: true }); when running the worker standalone we
    // just authenticate — no schema changes from here.
    const { sequelize } = require('../models');
    await sequelize.authenticate();
    console.log('[submitWorker] standalone · DB connected');
    await mountSubmitWorker();

    const stop = async () => {
      console.log('[submitWorker] shutting down…');
      await shutdown();
      await sequelize.close();
      process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  })().catch((err) => {
    console.error('[submitWorker] fatal boot error:', err);
    process.exit(1);
  });
}

module.exports = { mountSubmitWorker, handleJob };
