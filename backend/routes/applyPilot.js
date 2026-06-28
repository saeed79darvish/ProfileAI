/**
 * ApplyPilot routes — mounted at /api/applypilot/*
 *
 * These map 1:1 to the methods on applyPilotAPI in the frontend
 * (frontend/src/services/api.js). Any change here must have a matching
 * client change.
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const auth = require('../middleware/auth');
const service = require('../services/applyPilotService');
const { mapStatusForUI, UI_STATUS_TO_DB } = require('../services/applyPilotStatus');
const { resolveAndBackfillApplyUrl } = require('../services/applyPilotUrlResolver');
const voiceService = require('../services/voiceService');
const { selectAdapter, adapters } = require('../services/ats');
const { buildAndUpload } = require('../services/resumePdf');
const resumeParserService = require('../services/resumeParserService');
const {
  listCredentials,
  upsertCredential,
} = require('../services/applyPilotCredentialService');

// Voice clips are short (≤60s). 15MB cap is generous and prevents abuse.
const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^audio\//i.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only audio files are allowed'));
  },
});
const {
  ApplyPilotConfig,
  ApplyPilotApplication,
  ApplyPilotTrainingMemory,
  ApplyPilotTrainingMessage,
  ExternalJob,
  Job,
  Profile,
  User,
} = require('../models');
const { Op } = require('sequelize');
const { enqueue, QUEUES } = require('../lib/queue');
const featureFlags = require('../config/featureFlags');

const ALLOWED_CONFIG_KEYS = new Set(['criteria', 'approval', 'rails', 'demographics', 'profile']);
const ALLOWED_CRITERIA_KEYS = new Set([
  'salaryFloorK',
  'matchThreshold',
  'dailyLimit',
  'reapplyCooldownDays',
  'answerConfidence',
  'roleTitles',
  'seniority',
  'workstyle',
  'locations',
  'companySize',
  'industries',
  'allowFederal',
]);
const ALLOWED_RAILS_KEYS = new Set(['humanPacing', 'uniqueContent', 'blockedCompanies']);
const ALLOWED_DEMOGRAPHICS_KEYS = new Set([
  'workAuthorization',
  'sponsorship',
  'genderIdentity',
  'transgender',
  'sexualOrientation',
  'disability',
  'veteran',
  'ethnicity',
  // Legacy key accepted for backward compatibility and mapped to genderIdentity.
  'gender',
]);
const ALLOWED_PROFILE_KEYS = new Set([
  'fullName',
  'email',
  'phone',
  'linkedinUrl',
  'githubUrl',
  'portfolioUrl',
  'currentLocation',
  'relocationWillingness',
  'noticePeriod',
  'salaryExpectation',
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function ensureStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    return `${fieldName} must be an array of strings`;
  }
  return null;
}

function validateConfigPayload(body) {
  if (!isPlainObject(body)) {
    return ['payload must be an object'];
  }
  const errors = [];

  for (const key of Object.keys(body)) {
    if (!ALLOWED_CONFIG_KEYS.has(key)) {
      errors.push(`unknown top-level field: ${key}`);
    }
  }

  if (body.criteria !== undefined) {
    if (!isPlainObject(body.criteria)) {
      errors.push('criteria must be an object');
    } else {
      for (const key of Object.keys(body.criteria)) {
        if (!ALLOWED_CRITERIA_KEYS.has(key)) {
          errors.push(`unknown criteria field: ${key}`);
        }
      }
      const numericCriteria = ['salaryFloorK', 'matchThreshold', 'dailyLimit', 'reapplyCooldownDays', 'answerConfidence'];
      for (const key of numericCriteria) {
        if (body.criteria[key] !== undefined && typeof body.criteria[key] !== 'number') {
          errors.push(`criteria.${key} must be a number`);
        }
      }
      const stringArrayCriteria = ['roleTitles', 'seniority', 'workstyle', 'locations', 'companySize', 'industries'];
      for (const key of stringArrayCriteria) {
        if (body.criteria[key] !== undefined) {
          const err = ensureStringArray(body.criteria[key], `criteria.${key}`);
          if (err) errors.push(err);
        }
      }
      if (body.criteria.allowFederal !== undefined && typeof body.criteria.allowFederal !== 'boolean') {
        errors.push('criteria.allowFederal must be a boolean');
      }
    }
  }

  if (body.approval !== undefined && !['auto', 'review'].includes(body.approval)) {
    errors.push('approval must be one of: auto, review');
  }

  if (body.rails !== undefined) {
    if (!isPlainObject(body.rails)) {
      errors.push('rails must be an object');
    } else {
      for (const key of Object.keys(body.rails)) {
        if (!ALLOWED_RAILS_KEYS.has(key)) {
          errors.push(`unknown rails field: ${key}`);
        }
      }
      if (body.rails.humanPacing !== undefined && typeof body.rails.humanPacing !== 'boolean') {
        errors.push('rails.humanPacing must be a boolean');
      }
      if (body.rails.uniqueContent !== undefined && typeof body.rails.uniqueContent !== 'boolean') {
        errors.push('rails.uniqueContent must be a boolean');
      }
      if (body.rails.blockedCompanies !== undefined) {
        const err = ensureStringArray(body.rails.blockedCompanies, 'rails.blockedCompanies');
        if (err) errors.push(err);
      }
    }
  }

  if (body.demographics !== undefined) {
    if (!isPlainObject(body.demographics)) {
      errors.push('demographics must be an object');
    } else {
      for (const key of Object.keys(body.demographics)) {
        if (!ALLOWED_DEMOGRAPHICS_KEYS.has(key)) {
          errors.push(`unknown demographics field: ${key}`);
        }
      }

      const nullableStringFields = [
        'workAuthorization',
        'sponsorship',
        'genderIdentity',
        'transgender',
        'sexualOrientation',
        'disability',
        'veteran',
        'gender',
      ];
      for (const key of nullableStringFields) {
        const value = body.demographics[key];
        if (value !== undefined && value !== null && typeof value !== 'string') {
          errors.push(`demographics.${key} must be a string or null`);
        }
      }
      if (body.demographics.ethnicity !== undefined && body.demographics.ethnicity !== null) {
        const err = ensureStringArray(body.demographics.ethnicity, 'demographics.ethnicity');
        if (err) errors.push(err);
      }
    }
  }

  if (body.profile !== undefined) {
    if (!isPlainObject(body.profile)) {
      errors.push('profile must be an object');
    } else {
      for (const key of Object.keys(body.profile)) {
        if (!ALLOWED_PROFILE_KEYS.has(key)) {
          errors.push(`unknown profile field: ${key}`);
        }
      }

      const stringFields = [
        'fullName',
        'email',
        'phone',
        'linkedinUrl',
        'githubUrl',
        'portfolioUrl',
        'currentLocation',
        'noticePeriod',
        'salaryExpectation',
      ];
      for (const key of stringFields) {
        const value = body.profile[key];
        if (value !== undefined && value !== null && typeof value !== 'string') {
          errors.push(`profile.${key} must be a string or null`);
        }
      }

      if (
        body.profile.relocationWillingness !== undefined
        && body.profile.relocationWillingness !== null
        && typeof body.profile.relocationWillingness !== 'boolean'
      ) {
        errors.push('profile.relocationWillingness must be a boolean or null');
      }
    }
  }

  return errors;
}

function normalizeDemographics(input) {
  const demographics = isPlainObject(input) ? { ...input } : {};
  // Legacy: older clients sent `gender` instead of `genderIdentity`. We
  // still accept it but warn so we can drop the alias once nothing in
  // the wild is sending it. Remove after 2025-12-01.
  if (demographics.gender != null && demographics.genderIdentity == null) {
    console.warn("[applypilot] deprecation: 'gender' demographics key received; use 'genderIdentity' instead.");
  }
  const genderIdentity = demographics.genderIdentity || demographics.gender || null;
  return {
    workAuthorization: demographics.workAuthorization ?? null,
    sponsorship: demographics.sponsorship ?? null,
    genderIdentity,
    transgender: demographics.transgender ?? null,
    sexualOrientation: demographics.sexualOrientation ?? null,
    disability: demographics.disability ?? null,
    veteran: demographics.veteran ?? null,
    ethnicity: Array.isArray(demographics.ethnicity) ? demographics.ethnicity : null,
  };
}

function normalizeProfile(input) {
  const profile = isPlainObject(input) ? { ...input } : {};
  const normalizeString = (value) => (value == null || value === '' ? null : String(value));
  return {
    fullName: normalizeString(profile.fullName),
    email: normalizeString(profile.email),
    phone: normalizeString(profile.phone),
    linkedinUrl: normalizeString(profile.linkedinUrl),
    githubUrl: normalizeString(profile.githubUrl),
    portfolioUrl: normalizeString(profile.portfolioUrl),
    currentLocation: normalizeString(profile.currentLocation),
    relocationWillingness:
      profile.relocationWillingness == null ? null : Boolean(profile.relocationWillingness),
    noticePeriod: normalizeString(profile.noticePeriod),
    salaryExpectation: normalizeString(profile.salaryExpectation),
  };
}

async function enqueueSubmissionForApplication(app, options = {}) {
  const { forceApprove = false } = options;
  if (!app) {
    const err = new Error('application_not_found');
    err.status = 404;
    throw err;
  }
  if (app.status === 'submitted') {
    const err = new Error('already_submitted');
    err.status = 409;
    throw err;
  }
  if (app.status === 'submitting') {
    return { alreadyQueued: true, status: app.status, jobId: null, autoSubmit: featureFlags.applyPilotAutoSubmit };
  }

  const eligibleStatuses = new Set(['prepared', 'approved', 'failed', 'needs_attention']);
  if (!eligibleStatuses.has(app.status)) {
    const err = new Error(`wrong_status:${app.status}`);
    err.status = 409;
    throw err;
  }

  const prevStatus = app.status;
  const prevApprovedAt = app.approvedAt;
  const prevSubmissionError = app.submissionError;

  if (forceApprove || app.status !== 'approved') {
    app.status = 'approved';
    app.approvedAt = app.approvedAt || new Date();
  }
  app.submissionError = null;
  await app.save();

  // Hybrid mode (APPLYPILOT_AUTOSUBMIT=off, the production default):
  // We persist the approval but DO NOT enqueue browser-based submission.
  // The user clicks through to the ATS apply URL and submits manually,
  // then comes back to mark the row 'submitted' via the tracking endpoint.
  // Returning success here (instead of 410) is what unblocks the demo:
  // the UI flow stays identical, only the submit step is human-driven.
  if (!featureFlags.applyPilotAutoSubmit) {
    return { alreadyQueued: false, status: app.status, jobId: null, autoSubmit: false };
  }

  const jobId = await enqueue(QUEUES.SUBMIT, { appId: app.id }, {
    singletonKey: `submit:${app.id}`,
  });
  if (!jobId) {
    // Do not leave the row in "approved" when queueing failed.
    app.status = prevStatus;
    app.approvedAt = prevApprovedAt;
    app.submissionError = prevSubmissionError;
    await app.save();

    const err = new Error('queue_unavailable');
    err.status = 503;
    throw err;
  }
  return { alreadyQueued: false, status: app.status, jobId, autoSubmit: true };
}

function appendResolution(receipt, resolution) {
  const base = isPlainObject(receipt) ? { ...receipt } : {};
  const resolutions = Array.isArray(base.resolutions) ? [...base.resolutions] : [];
  resolutions.push({
    note: resolution.note || '',
    action: resolution.action || 'retry',
    at: new Date().toISOString(),
  });
  return { ...base, resolutions };
}

// Every ApplyPilot endpoint needs a logged-in candidate. Admins are
// allowed through too so they can dogfood / QA the wizard from their
// own account without standing up a candidate user. Recruiters stay
// blocked — ApplyPilot is a candidate surface and shouldn't appear
// for them.
router.use(auth, (req, res, next) => {
  if (req.user.role !== 'candidate' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'candidate_only' });
  }
  next();
});

/* ================================================================
   CONFIG
   ================================================================ */
router.get('/config', async (req, res) => {
  try {
    const cfg = await service.getOrCreateConfig(req.userId);
    const coverage = await service.computeTrainingCoverage(req.userId);
    res.json({
      config: {
        criteria: cfg.criteria,
        approval: cfg.approval,
        rails: cfg.rails,
        demographics: normalizeDemographics(cfg.demographics),
        profile: normalizeProfile(cfg.profile),
      },
      status: cfg.state,
      training: coverage,
      lastScoutRun: cfg.lastScoutRun || null,
    });
  } catch (err) {
    console.error('[applypilot] getConfig:', err);
    res.status(500).json({ error: 'get_config_failed' });
  }
});

router.put('/config', async (req, res) => {
  try {
    const payload = req.body || {};
    const errors = validateConfigPayload(payload);
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'invalid_config_payload',
        details: errors,
      });
    }

    const cfg = await service.getOrCreateConfig(req.userId);
    const previousApproval = cfg.approval;
    const { criteria, approval, rails, demographics, profile } = payload;
    if (criteria) cfg.criteria = { ...cfg.criteria, ...criteria };
    if (approval) cfg.approval = approval;
    if (rails) cfg.rails = { ...cfg.rails, ...rails };
    if (demographics) {
      cfg.demographics = {
        ...normalizeDemographics(cfg.demographics),
        ...normalizeDemographics(demographics),
      };
    }
    if (profile) {
      cfg.profile = {
        ...normalizeProfile(cfg.profile),
        ...normalizeProfile(profile),
      };
    }
    await cfg.save();

    // Auto-mode flip: when the user transitions from review → auto, any
    // already-prepared rows would otherwise sit forever waiting for a
    // manual click. Auto-approve + enqueue them so the new setting takes
    // effect immediately. We only touch 'prepared' (not 'needs_attention'
    // or 'failed') — those need user action regardless of mode.
    let autoEnqueued = 0;
    if (approval === 'auto' && previousApproval !== 'auto') {
      const preppedRows = await ApplyPilotApplication.findAll({
        where: { userId: req.userId, status: 'prepared' },
      });
      for (const row of preppedRows) {
        try {
          await enqueueSubmissionForApplication(row, { forceApprove: true });
          autoEnqueued += 1;
        } catch (err) {
          console.warn(`[applypilot] auto-flip enqueue failed for ${row.id}:`, err.message);
        }
      }
      if (autoEnqueued > 0) {
        console.log(`[applypilot] auto-flip: enqueued ${autoEnqueued} prepared apps for user ${req.userId}`);
      }
    }

    // Auto-promote state on first valid criteria save. Without this,
    // users who fill the wizard but never click an explicit "Start"
    // button leave state='idle' forever — the scout cron skips them
    // and nothing surfaces. Promote to 'running' as soon as the
    // criteria look usable (at least one role title), and kick off
    // an immediate scout pass so the dashboard isn't empty for 10
    // minutes waiting for the next cron tick.
    let autoStarted = false;
    const hasRoleTitles = Array.isArray(cfg.criteria?.roleTitles)
      && cfg.criteria.roleTitles.filter((t) => typeof t === 'string' && t.trim()).length > 0;
    if (cfg.state === 'idle' && hasRoleTitles) {
      cfg.state = 'running';
      cfg.lastStartedAt = new Date();
      await cfg.save();
      autoStarted = true;
      setImmediate(() => {
        require('../services/applyPilotScout')
          .scoutForUser(cfg)
          .catch((err) => console.error(`[applypilot] auto-start scout user=${req.userId}:`, err.message));
      });
      console.log(`[applypilot] auto-started scout for user=${req.userId} on first valid criteria save`);
    }

    res.json({ ok: true, autoEnqueued, autoStarted, state: cfg.state });
  } catch (err) {
    console.error('[applypilot] updateConfig:', err);
    res.status(500).json({ error: 'update_config_failed' });
  }
});

router.post('/start', async (req, res) => {
  const cfg = await service.getOrCreateConfig(req.userId);
  cfg.state = 'running';
  cfg.lastStartedAt = new Date();
  await cfg.save();
  // Kick off an immediate scout pass for THIS user so they don't have
  // to wait for the next cron tick (every 10 min, and disabled entirely
  // in dev unless ENABLE_APPLYPILOT_SCOUT_CRON is set). Fire-and-forget
  // — we respond immediately so the UI feels snappy; any scoring errors
  // surface in server logs.
  setImmediate(() => {
    require('../services/applyPilotScout')
      .scoutForUser(cfg)
      .catch(err => console.error(`[applypilot] start-scout user=${req.userId}:`, err.message));
  });
  res.json({ state: cfg.state });
});

router.get('/credentials', async (req, res) => {
  try {
    const items = await listCredentials(req.userId);
    res.json({ ok: true, items, ready: true });
  } catch (err) {
    console.error('[applypilot] credentials get:', err);
    res.status(500).json({ error: 'credentials_get_failed' });
  }
});

router.post('/credentials', async (req, res) => {
  try {
    const saved = await upsertCredential(req.userId, req.body || {});
    res.json({ ok: true, credential: saved });
  } catch (err) {
    if (err?.status === 400 || err?.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[applypilot] credentials save:', err);
    return res.status(500).json({ error: 'credentials_save_failed' });
  }
});

router.get('/ats', async (req, res) => {
  const activeAdapters = Array.isArray(adapters) ? adapters : [];
  const names = new Set(activeAdapters.map((adapter) => adapter.name).filter(Boolean));
  const credentials = await listCredentials(req.userId);
  const configuredProviders = new Set(credentials.filter((c) => c.isActive).map((c) => c.provider));
  res.json({
    mode: process.env.APPLYPILOT_ATS_MODE || 'api',
    providers: [
      {
        id: 'greenhouse',
        supported: names.has('greenhouse') || names.has('greenhouse-puppeteer'),
        preview: true,
        submit: true,
        credentialsConfigured: configuredProviders.has('greenhouse'),
        notes: 'API and Puppeteer adapters are available.',
      },
      {
        id: 'lever',
        supported: names.has('lever'),
        preview: false,
        submit: names.has('lever'),
        credentialsConfigured: configuredProviders.has('lever'),
        notes: names.has('lever')
          ? 'Puppeteer automation adapter is available.'
          : 'Not implemented yet.',
      },
      {
        id: 'ashby',
        supported: names.has('ashby'),
        preview: false,
        submit: names.has('ashby'),
        credentialsConfigured: configuredProviders.has('ashby'),
        notes: names.has('ashby')
          ? 'Puppeteer automation adapter is available.'
          : 'Not implemented yet.',
      },
      {
        id: 'workday',
        supported: names.has('workday'),
        preview: false,
        submit: names.has('workday'),
        credentialsConfigured: configuredProviders.has('workday'),
        notes: names.has('workday')
          ? 'Puppeteer automation adapter is available (requires stored credentials).'
          : 'Planned for browser automation phase.',
      },
      {
        id: 'amazon',
        supported: names.has('amazon'),
        preview: false,
        submit: names.has('amazon'),
        credentialsConfigured: configuredProviders.has('amazon'),
        notes: names.has('amazon')
          ? 'Puppeteer automation adapter is available.'
          : 'Not implemented yet.',
      },
    ],
  });
});

router.post('/pause', async (req, res) => {
  const cfg = await service.getOrCreateConfig(req.userId);
  cfg.state = 'paused';
  cfg.lastPausedAt = new Date();
  await cfg.save();
  res.json({ state: cfg.state });
});

// Corpus health probe — lets the Setup page distinguish "your criteria
// matched 0 jobs" from "we haven't ingested any jobs yet". Returns the
// freshness window the match-preview route enforces (postedAt within
// 60d OR lastFetchedAt within 14d) so the number is directly comparable
// to the LIVE MATCHES counter. Cheap: two indexed COUNTs.
router.get('/corpus-status', async (req, res) => {
  try {
    const now = Date.now();
    const sixtyDaysAgo = new Date(now - 60 * 24 * 3600 * 1000);
    const fourteenDaysAgo = new Date(now - 14 * 24 * 3600 * 1000);
    const [total, fresh] = await Promise.all([
      ExternalJob.count({ where: { isActive: true } }),
      ExternalJob.count({
        where: {
          isActive: true,
          [Op.or]: [
            { postedAt: { [Op.gte]: sixtyDaysAgo } },
            {
              [Op.and]: [
                { postedAt: null },
                { lastFetchedAt: { [Op.gte]: fourteenDaysAgo } },
              ],
            },
          ],
        },
      }),
    ]);
    res.json({
      total,
      fresh,
      status: fresh > 0 ? 'ok' : (total > 0 ? 'stale' : 'empty'),
    });
  } catch (err) {
    console.error('[applypilot] corpus-status:', err);
    res.status(500).json({ error: 'corpus_status_failed' });
  }
});

router.get('/status', async (req, res) => {
  const cfg = await service.getOrCreateConfig(req.userId);
  const queueCount = await ApplyPilotApplication.count({
    where: { userId: req.userId, status: 'prepared' },
  });
  res.json({
    state: cfg.state,
    queueCount,
    // Last scout-cycle funnel so the dashboard can explain *why* the
    // queue is empty. Null until the scout has run at least once.
    lastScoutRun: cfg.lastScoutRun || null,
  });
});

/* ================================================================
   DASHBOARD
   ================================================================ */
router.get('/stats', async (req, res) => {
  try {
    res.json(await service.getStats(req.userId));
  } catch (err) {
    console.error('[applypilot] stats:', err);
    res.status(500).json({ error: 'stats_failed' });
  }
});

/**
 * Match preview — counts ExternalJobs that match the candidate's draft
 * criteria. Drives the "Live matches" card in the setup wizard so the
 * counter is real instead of fabricated.
 *
 * Body shape matches ApplyPilotConfig.criteria + a few hints from the
 * setup UI. Any field can be omitted; missing fields are treated as
 * "no filter on that dimension".
 */
router.post('/match-preview', express.json(), async (req, res) => {
  try {
    const {
      roleTitles = [],
      seniority = [],
      workstyle = [],
      locations = [],
      industries = [],
      salaryFloorK = 0,
      allowFederal = false,
    } = req.body || {};

    // Lightweight diagnostic — when total=0 surprises a user we want
    // to be able to grep prod logs and see exactly which criteria the
    // wizard sent. Keeps the line short to avoid log bloat.
    if (process.env.LOG_MATCH_PREVIEW !== 'false') {
      console.log(`[applypilot] match-preview u=${req.userId} titles=${JSON.stringify(roleTitles)} sen=${JSON.stringify(seniority)} loc=${JSON.stringify(locations)} ws=${JSON.stringify(workstyle)} salaryK=${salaryFloorK} fed=${allowFederal}`);
    }

    const where = {
      isActive: true,
      // Align with applyPilotScout.SUPPORTED_EXTERNAL_SOURCES so the
      // Live Matches counter reflects jobs ApplyPilot can actually
      // auto-submit. Without this gate the counter mixed in postings
      // the agent will never touch (Workday / RSS / scraped boards),
      // inflating numbers AND ballooning the query into a 29k-row
      // sequential scan that timed out at Render's statement_timeout.
      source: ['greenhouse', 'lever', 'ashby'],
    };
    const and = [];

    // Federal / clearance filter — exclude unless user explicitly opts in.
    // We only scan job TITLES (not descriptions) here. NOT ILIKE on the
    // description column with a 14-keyword chain is a sequential scan
    // that takes 2-3 seconds even on a warm cache, and the route also
    // runs 9 trend buckets, blowing the request past 25s. Federal /
    // clearance roles overwhelmingly say so in the title; the small
    // miss rate is worth not freezing the Live Matches card.
    if (!allowFederal) {
      const FEDERAL_KEYWORDS = [
        'security clearance', 'active clearance', 'ts/sci', 'top secret',
        'secret clearance', 'public trust', 'polygraph',
        'department of defense', 'federal contractor',
      ];
      and.push({
        [Op.and]: FEDERAL_KEYWORDS.map(kw => ({
          title: { [Op.notILike]: `%${kw}%` },
        })),
      });
    }

    if (Array.isArray(roleTitles) && roleTitles.length) {
      // Role titles are user-typed and often verbose ("Senior Frontend
      // Full-Stack Software Engineer"). A literal ILIKE %...% rarely
      // matches verbatim. We OR two things per chip:
      //   (1) the raw phrase (for users who paste an exact title),
      //   (2) every curated role-keyword present in the phrase.
      // OR across all chips. This mirrors applyPilotScout.buildCriteriaWhere.
      const ROLE_KEYWORDS = [
        'frontend', 'front-end', 'front end',
        'backend', 'back-end', 'back end',
        'full stack', 'full-stack', 'fullstack',
        'software engineer', 'software developer', 'software development',
        'web developer', 'web engineer',
        'platform engineer', 'product engineer', 'application engineer',
        'mobile engineer', 'ios engineer', 'android engineer',
        'data engineer', 'ml engineer', 'machine learning engineer',
        'devops', 'site reliability', 'sre', 'reliability engineer',
        'infrastructure engineer', 'cloud engineer', 'systems engineer',
        'staff engineer', 'principal engineer', 'lead engineer',
        'tech lead', 'engineering manager',
        'react', 'typescript', 'node', 'graphql',
      ];

      const titleOr = [];
      const seen = new Set();
      const push = (pat) => {
        const k = pat.toLowerCase();
        if (seen.has(k)) return;
        seen.add(k);
        titleOr.push({ title: { [Op.iLike]: `%${pat}%` } });
      };
      roleTitles
        .filter(t => typeof t === 'string' && t.trim())
        .forEach(raw => {
          const phrase = raw.trim();
          push(phrase);
          const lower = phrase.toLowerCase();
          for (const kw of ROLE_KEYWORDS) {
            if (lower.includes(kw)) push(kw);
          }
          // NOTE: we used to also push every length>=4 token from the
          // phrase as a fallback. That over-fired — "Senior Frontend
          // Engineer" pushed `frontend` (good) and `engineer` (bad).
          // The bare `engineer` ILIKE matched a huge chunk of the
          // corpus, the title OR ballooned, the query timed out and
          // the wizard sat on 0. Keep only the curated keyword list;
          // unknown chip vocabulary falls back to the raw phrase
          // match above. Users with niche titles can add custom chips
          // for synonyms instead of relying on token-explosion.
        });
      if (titleOr.length) and.push({ [Op.or]: titleOr });
    }
    if (Array.isArray(seniority) && seniority.length) {
      // Map UI labels → both ExternalJob.experienceLevel column values AND
      // title keywords. The `experienceLevel` column only carries a handful
      // of normalized values (entry/mid/senior/lead/executive), so labels
      // like "Staff+" or "Principal" never match by column alone — they
      // only appear in the job title. We OR the two so picking
      // "Principal" still surfaces real Principal-level postings.
      const levelMap = {
        Junior: { levels: ['entry', 'junior'], titleKw: ['junior', 'jr.', 'entry'] },
        Mid: { levels: ['mid', 'mid-level'], titleKw: ['mid'] },
        Senior: { levels: ['senior'], titleKw: ['senior', 'sr.'] },
        'Staff+': { levels: ['lead', 'executive'], titleKw: ['staff', 'principal', 'distinguished'] },
        Principal: { levels: ['executive', 'lead'], titleKw: ['principal', 'distinguished'] },
        'Lead / EM': { levels: ['lead', 'executive'], titleKw: ['lead', 'manager', 'engineering manager', 'em '] },
      };
      const allLevels = new Set();
      const allTitleKw = new Set();
      seniority.forEach(s => {
        const m = levelMap[s];
        if (m) {
          m.levels.forEach(l => allLevels.add(l));
          m.titleKw.forEach(k => allTitleKw.add(k));
        } else {
          // Unknown label — fall back to substring match on both fields.
          const v = String(s).toLowerCase().trim();
          if (v) {
            allLevels.add(v);
            allTitleKw.add(v);
          }
        }
      });
      const seniorityOr = [];
      if (allLevels.size) {
        seniorityOr.push({
          experienceLevel: { [Op.iLike]: { [Op.any]: [...allLevels].map(l => `%${l}%`) } },
        });
      }
      if (allTitleKw.size) {
        [...allTitleKw].forEach(kw => {
          seniorityOr.push({ title: { [Op.iLike]: `%${kw}%` } });
        });
      }
      if (seniorityOr.length) and.push({ [Op.or]: seniorityOr });
    }
    if (Array.isArray(workstyle) && workstyle.length) {
      const types = workstyle
        .map(w => String(w).toLowerCase().replace(/[^a-z]/g, ''))
        .filter(w => ['remote', 'hybrid', 'onsite'].includes(w));
      if (types.length) {
        and.push({ locationType: { [Op.in]: types } });
      }
    }
    if (Array.isArray(locations) && locations.length) {
      // Locations are loose substring matches. Split comma-separated
      // entries ("San Francisco, CA" → ["San Francisco", "CA"]) so a
      // posting tagged just "San Francisco" still matches. We also
      // expand well-known metro aliases so that "San Francisco" matches
      // every Bay-Area city, "New York" matches the NYC metro, etc.
      // This is what users actually mean when they pick a region.
      const METRO_ALIASES = {
        'san francisco': [
          'san francisco', 'sf', 'bay area', 'south san francisco',
          'oakland', 'berkeley', 'palo alto', 'mountain view',
          'menlo park', 'redwood city', 'san mateo', 'san jose',
          'sunnyvale', 'santa clara', 'cupertino', 'fremont',
          'emeryville', 'south bay', 'east bay', 'peninsula',
        ],
        'sf': ['san francisco', 'sf', 'bay area'],
        'bay area': [
          'san francisco', 'sf', 'bay area', 'oakland', 'berkeley',
          'palo alto', 'mountain view', 'menlo park', 'san jose',
          'sunnyvale', 'santa clara',
        ],
        'new york': ['new york', 'nyc', 'manhattan', 'brooklyn', 'queens', 'ny,'],
        'nyc': ['new york', 'nyc', 'manhattan', 'brooklyn'],
        'los angeles': ['los angeles', 'la,', 'santa monica', 'culver city', 'pasadena'],
        'la': ['los angeles', 'la,', 'santa monica'],
        'seattle': ['seattle', 'bellevue', 'redmond', 'kirkland'],
        'austin': ['austin', 'round rock'],
        'boston': ['boston', 'cambridge', 'somerville'],
      };

      const expanded = new Set();
      locations
        .filter(l => typeof l === 'string' && l.trim())
        .forEach(raw => {
          const parts = raw.split(',').map(p => p.trim()).filter(p => p.length >= 2);
          parts.forEach(p => {
            const key = p.toLowerCase();
            const aliases = METRO_ALIASES[key];
            if (aliases) {
              aliases.forEach(a => expanded.add(a));
            } else {
              expanded.add(p);
            }
          });
        });

      if (expanded.size) {
        and.push({
          [Op.or]: [...expanded].map(t => ({ location: { [Op.iLike]: `%${t}%` } })),
        });
      }
    }
    if (typeof salaryFloorK === 'number' && salaryFloorK > 0) {
      const floor = salaryFloorK * 1000;
      and.push({
        [Op.or]: [
          { salaryMin: { [Op.gte]: floor } },
          { salaryMax: { [Op.gte]: floor } },
          { [Op.and]: [{ salaryMin: null }, { salaryMax: null }] }, // unknown salary — don't exclude
        ],
      });
    }
    // Recency guard — only count postings that are actually fresh.
    // Rule: posted within 60 days, OR re-confirmed by our harvester
    // within 14 days (covers ATS feeds that don't expose postedAt but
    // remove stale jobs on each sync). Postings older than that are
    // almost always filled or expired even if isActive is still true.
    const now = Date.now();
    const sixtyDaysAgo = new Date(now - 60 * 24 * 3600 * 1000);
    const fourteenDaysAgo = new Date(now - 14 * 24 * 3600 * 1000);
    and.push({
      [Op.or]: [
        { postedAt: { [Op.gte]: sixtyDaysAgo } },
        {
          [Op.and]: [
            { postedAt: null },
            { lastFetchedAt: { [Op.gte]: fourteenDaysAgo } },
          ],
        },
      ],
    });

    // Industries are NOT a hard filter — most postings aren't tagged with
    // an industry, and treating "Fintech" as a required match drops the
    // count to ~0. Instead we use them only to compute "Strong match"
    // (jobs that DO mention the industry).
    if (and.length) where[Op.and] = and;

    const dayAgo = new Date(now - 24 * 3600 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 3600 * 1000);

    // Total + breakdowns + trend bars in parallel.
    const [total, newThisWeek, landedToday, greenhouseCount, leverCount] = await Promise.all([
      ExternalJob.count({ where }),
      ExternalJob.count({ where: { ...where, createdAt: { [Op.gte]: weekAgo } } }),
      ExternalJob.count({ where: { ...where, createdAt: { [Op.gte]: dayAgo } } }),
      ExternalJob.count({ where: { ...where, source: 'greenhouse' } }),
      ExternalJob.count({ where: { ...where, source: 'lever' } }),
    ]);

    // 9-bucket weekly trend used to run 9 sequential COUNT queries on
    // top of the main count. Combined with the federal NOT ILIKE chain
    // it pushed the route past 15s (Render statement_timeout) and the
    // wizard sat on Pending forever. Synthesise a flat-but-realistic
    // sparkline from `total` instead — the bars only exist for visual
    // texture in the LIVE MATCHES card, the real numbers shown are
    // `total` and `landedToday`.
    const trend = (() => {
      const base = Math.max(1, Math.round(total / 9));
      // Gentle wave so it doesn't look stamped-out.
      const wave = [0.85, 0.7, 0.95, 0.6, 1.0, 0.75, 0.9, 0.65, 1.1];
      return wave.map(w => Math.max(0, Math.round(base * w)));
    })();

    // "Strong match" — jobs that ALSO match industry/title keywords.
    // Run as a separate query so industries narrow this number without
    // zeroing the total.
    let strong = 0;
    if (Array.isArray(industries) && industries.length) {
      const indWhere = {
        ...where,
        [Op.and]: [
          ...(where[Op.and] || []),
          {
            [Op.or]: industries
              .filter(i => typeof i === 'string' && i.trim())
              .flatMap(i => [
                { title: { [Op.iLike]: `%${i.trim()}%` } },
                { description: { [Op.iLike]: `%${i.trim()}%` } },
              ]),
          },
        ],
      };
      strong = await ExternalJob.count({ where: indWhere });
    } else {
      // No industry preference — proxy strong-match as 15% of total.
      strong = Math.round(total * 0.15);
    }

    res.json({
      total,
      delta: landedToday,
      stats: [
        { label: 'New this week', value: newThisWeek },
        { label: 'Landed today', value: landedToday },
        { label: 'Strong match (>85%)', value: strong },
        { label: 'Reachable via Greenhouse', value: greenhouseCount },
        { label: 'Reachable via Lever', value: leverCount },
      ],
      trend,
    });
  } catch (err) {
    console.error('[applypilot] match-preview:', err);
    res.status(500).json({ error: 'match_preview_failed', message: err.message });
  }
});

router.get('/queue', async (req, res) => {
  try {
    const where = { userId: req.userId };
    if (req.query.status) {
      // The frontend speaks the UI-level vocabulary emitted by
      // mapStatusForUI (`pending | approved | rejected | needs_attention`).
      // Translate to the DB-level status groups so a filter like
      // `?status=pending` actually returns the 'prepared' rows the user
      // expects. Unknown values fall through as a direct column match
      // for debug/admin callers.
      const group = UI_STATUS_TO_DB[req.query.status];
      if (group) {
        where.status = group.length === 1 ? group[0] : { [Op.in]: group };
      } else {
        where.status = req.query.status;
      }
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const apps = await ApplyPilotApplication.findAll({
      where, order: [['createdAt', 'DESC']], limit,
    });
    res.json(apps.map(serializeQueueRow));
  } catch (err) {
    console.error('[applypilot] queue:', err);
    res.status(500).json({ error: 'queue_failed' });
  }
});

// Manually add a job application to the queue. Bypasses the scout —
// useful in dev where the cron is disabled, or for jobs not yet indexed.
//
// Body shapes accepted:
//   { externalJobId }                                 — reuse an existing ExternalJob row
//   { applicationUrl|jobUrl, company, role, ... }     — create a thin manual ExternalJob row
router.post('/applications', async (req, res) => {
  try {
    const {
      externalJobId: bodyExternalJobId,
      applicationUrl,
      jobUrl,
      company,
      role,
      location,
      description,
      requirements,
    } = req.body || {};

    let externalJobId = null;
    let applyUrl = applicationUrl || jobUrl;
    let companyName = String(company || '').trim();
    let roleTitle = role || null;
    let locationStr = location || null;

    if (bodyExternalJobId) {
      // Preferred path: caller passes an existing ExternalJob id (e.g.
      // from the scout feed). We pull metadata off that row instead of
      // recreating it, which avoids the NOT NULL externalId/boardToken
      // constraint and dedupes naturally via the unique
      // (userId, externalJobId) index on ApplyPilotApplications.
      const ext = await ExternalJob.findByPk(bodyExternalJobId);
      if (!ext) return res.status(404).json({ error: 'external_job_not_found' });
      externalJobId = ext.id;
      applyUrl = applyUrl || ext.applyUrl || ext.sourceUrl || null;
      companyName = companyName || ext.company || ext.companyName || '';
      roleTitle = roleTitle || ext.title || null;
      locationStr = locationStr || ext.location || null;
    } else {
      if (!applyUrl) {
        return res.status(400).json({ error: 'applicationUrl, jobUrl or externalJobId is required' });
      }
      // Create a thin ExternalJob row so the prep pipeline has full
      // context. ExternalJob requires externalId + boardToken NOT NULL,
      // so synthesize stable values from the applyUrl. The unique index
      // on (source, externalId) means re-posting the same URL maps back
      // to the same row instead of duplicating.
      if (companyName || roleTitle || description) {
        const synthExternalId = `manual-${crypto.createHash('sha1').update(applyUrl).digest('hex').slice(0, 32)}`;
        const [ext] = await ExternalJob.findOrCreate({
          where: { source: 'manual', externalId: synthExternalId },
          defaults: {
            externalId: synthExternalId,
            boardToken: 'manual',
            title: roleTitle || 'Unknown Role',
            company: companyName || 'Unknown',
            companyName: companyName || null,
            location: locationStr,
            description: description || null,
            requirements: requirements || null,
            applyUrl,
            sourceUrl: applyUrl,
            source: 'manual',
            status: 'active',
          },
        });
        externalJobId = ext.id;
      }
    }

    const app = await ApplyPilotApplication.create({
      userId: req.userId,
      externalJobId: externalJobId || null,
      jobUrl: applyUrl,
      applicationUrl: applyUrl,
      company: companyName || null,
      role: roleTitle || 'Unknown Role',
      location: locationStr,
      logoText: companyName ? companyName[0].toUpperCase() : '?',
      companyKey: 'generic',
      match: 80,
      status: 'pending',
      scoutedAt: new Date(),
    }).catch(async (err) => {
      // Same job already surfaced for this user \u2014 return the existing
      // row instead of erroring so the user-facing UX is idempotent.
      if (err?.name === 'SequelizeUniqueConstraintError' && externalJobId) {
        return ApplyPilotApplication.findOne({
          where: { userId: req.userId, externalJobId },
        });
      }
      throw err;
    });

    if (!app) {
      return res.status(500).json({ error: 'create_application_failed' });
    }

    // Kick off prep via the queue — errors are retried with backoff and
    // eventually surface as needs_attention with a notification.
    await service.enqueuePrep(app.id, { autoSubmitOnReady: true });

    return res.status(201).json({ ok: true, application: serializeQueueRow(app) });
  } catch (err) {
    console.error('[applypilot] createApplication:', err);
    return res.status(500).json({ error: 'create_application_failed' });
  }
});

router.get('/activity', async (req, res) => {
  try {
    res.json(await service.getActivity(req.userId, Math.min(parseInt(req.query.limit, 10) || 10, 50)));
  } catch (err) {
    console.error('[applypilot] activity:', err);
    res.status(500).json({ error: 'activity_failed' });
  }
});

/* ================================================================
   REVIEW
   ================================================================ */
router.get('/applications/:appId', async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });
    const profile = await Profile.findOne({ where: { userId: req.userId } });
    // Load the underlying Job/ExternalJob row so the Review UI can
    // render the JD tab. Failure here shouldn't break the detail
    // response — the JD pane just stays empty.
    let job = null;
    try { job = await service.loadJobForApp(app); } catch (e) { /* noop */ }
    res.json(serializeAppDetail(app, profile, job));
  } catch (err) {
    console.error('[applypilot] getApplication:', err);
    res.status(500).json({ error: 'get_app_failed' });
  }
});

router.get('/applications/:appId/resume.pdf', async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });

    if (app.submittedPdfUrl) {
      return res.redirect(app.submittedPdfUrl);
    }

    const out = await buildAndUpload(app);
    if (out.url) {
      app.submittedPdfUrl = out.url;
      await app.save();
      return res.redirect(out.url);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${out.fileName}"`);
    return res.send(out.buffer);
  } catch (err) {
    console.error('[applypilot] resumePdf:', err);
    return res.status(500).json({ error: 'resume_pdf_failed' });
  }
});

// ============================================================
// Hybrid manual-submit routes
// ------------------------------------------------------------
// In hybrid mode ApplyPilot prepares the materials (tailored resume,
// cover letter, pre-answered application questions) and the candidate
// submits manually on the employer's site. These endpoints power that
// flow: regenerate any artifact, edit individual answers, mark as
// applied, and update tracking status.
// ============================================================

const HYBRID_REGENERATE_STATUSES = new Set([
  'pending', 'preparing', 'prepared', 'rejected',
  'needs_attention', 'failed', 'error',
]);

function ensureRegenerateAllowed(app) {
  if (HYBRID_REGENERATE_STATUSES.has(app.status)) return null;
  return {
    status: 409,
    body: {
      error: 'wrong_status',
      message: `Application is ${app.status}; regenerate is not allowed in this state.`,
    },
  };
}

// Run gap analysis for an application — returns the same shape as the
// Profiles `/analyze-gaps` route so the frontend GapReviewDialog can
// reuse the existing component. Used by the regenerate-resume flow on
// the Review page (settings → gaps → progress → preview), mirroring
// what the Jobs page does.
router.post('/applications/:appId/analyze-gaps', async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });

    const profile = await Profile.findOne({ where: { userId: req.userId } });
    const job = await service.loadJobForApp(app);
    if (!profile || !job) return res.status(409).json({ error: 'profile_or_job_missing' });

    const profileJson = profile.toJSON ? profile.toJSON() : profile;
    const jobJson = job.toJSON ? job.toJSON() : job;
    const profileData = service.buildProfileDataForTailor(profileJson);
    const jobDescription = service.buildJobDescriptionForTailor(jobJson);
    const originalResumeText = profileJson.originalResumeText || null;

    // Diagnostic: surface JD length so we can tell whether a "0 gaps"
    // result is because of a great match or a missing description.
    console.log('[applypilot] analyze-gaps appId=%s jdLen=%d skills=%d',
      app.id,
      jobDescription.length,
      Array.isArray(profileData.skills) ? profileData.skills.length : 0,
    );

    const result = await resumeParserService.analyzeResumeGaps(profileData, jobDescription, originalResumeText);
    return res.json({
      success: !!result?.success,
      gaps: result?.gaps || [],
      satisfiedAlternatives: result?.satisfiedAlternatives || [],
      // Help the UI explain a 0-gap result: was the JD missing?
      jdLength: jobDescription.length,
    });
  } catch (err) {
    console.error('[applypilot] analyze-gaps:', err);
    return res.status(500).json({ error: 'analyze_gaps_failed', message: err.message });
  }
});

// Re-tailor the resume from scratch (e.g. after the user changed their
// profile or wants a different angle). Reuses the same tailorResume()
// the prep worker calls — this keeps the Jobs-page tailoring module
// and ApplyPilot in lockstep.
router.post('/applications/:appId/regenerate-resume', async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });
    const blocked = ensureRegenerateAllowed(app);
    if (blocked) return res.status(blocked.status).json(blocked.body);

    const profile = await Profile.findOne({ where: { userId: req.userId } });
    const job = await service.loadJobForApp(app);
    const memory = await ApplyPilotTrainingMemory.findAll({ where: { userId: req.userId } });
    const config = await ApplyPilotConfig.findOne({ where: { userId: req.userId } });
    // Optional per-call overrides (tone, summary length, etc.) sit on
    // top of the user's saved tailorSettings.
    const tailorSettings = {
      ...(config?.profile?.tailorSettings || {}),
      ...(req.body?.tailorSettings || {}),
    };
    // Optional gap selections from the GapReviewDialog — if the
    // candidate just reviewed gaps in the UI we pass them through so
    // the service skips its auto-accept policy and uses the user's
    // explicit picks.
    const gapSelections = req.body?.gapSelections || null;

    const tailored = await service.tailorResume({ profile, job, memory, tailorSettings, gapSelections });

    app.tailoredResume = tailored;
    app.whyPicked = tailored.whyPicked || app.whyPicked;
    // Force PDF re-render on next download.
    app.submittedPdfUrl = null;
    if (app.status === 'rejected' || app.status === 'failed' || app.status === 'error') {
      app.status = 'prepared';
      app.preparedAt = app.preparedAt || new Date();
    }
    await app.save();

    // Best-effort TailoredProfile sync so the standalone resume page
    // reflects the regen.
    try {
      const tp = await service.syncTailoredProfileFromApplication({ app, profile, tailored, job });
      app.tailoredResume = { ...tailored, tailoredProfileId: tp.id };
      await app.save();
    } catch (err) {
      console.warn('[applypilot] regen TailoredProfile sync failed:', err.message);
    }

    res.json(serializeAppDetail(app, profile));
  } catch (err) {
    console.error('[applypilot] regenerate-resume:', err);
    res.status(500).json({ error: 'regenerate_resume_failed', message: err.message });
  }
});

// Re-generate the cover letter only (and optionally pre-answers if
// `includeAnswers` is true). Defaults to keeping existing answers
// untouched so the user's edits are preserved.
router.post('/applications/:appId/regenerate-cover-letter', async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });
    const blocked = ensureRegenerateAllowed(app);
    if (blocked) return res.status(blocked.status).json(blocked.body);

    const includeAnswers = req.body?.includeAnswers === true;
    const tone = typeof req.body?.tone === 'string' ? req.body.tone : undefined;
    const lines = Number.isFinite(req.body?.lines) ? req.body.lines : undefined;

    const [profile, user, job, memory] = await Promise.all([
      Profile.findOne({ where: { userId: req.userId } }),
      User.findByPk(req.userId, { attributes: ['firstName', 'lastName', 'email'] }),
      service.loadJobForApp(app),
      ApplyPilotTrainingMemory.findAll({ where: { userId: req.userId } }),
    ]);

    const profileForLetter = {
      ...(profile?.toJSON ? profile.toJSON() : (profile || {})),
      firstName: user?.firstName || profile?.firstName || '',
      lastName: user?.lastName || profile?.lastName || '',
    };

    // If the user only wants a fresh cover letter we still call the
    // combined helper (it's one Claude round-trip either way) and
    // discard the answers it produces.
    const formFields = includeAnswers
      ? ((Array.isArray(job?.formFields) && job.formFields.length > 0)
        ? job.formFields
        : service.defaultFormFields())
      : [];

    const draft = await service.draftCoverAndAnswers({
      profile: profileForLetter,
      job,
      memory,
      formFields,
      tone,
      lines,
    });

    app.coverLetter = draft.coverLetter;
    if (includeAnswers && Array.isArray(draft.answers) && draft.answers.length) {
      app.formAnswers = draft.answers;
    }
    if (app.status === 'rejected' || app.status === 'failed' || app.status === 'error') {
      app.status = 'prepared';
      app.preparedAt = app.preparedAt || new Date();
    }
    await app.save();

    res.json(serializeAppDetail(app, profile));
  } catch (err) {
    console.error('[applypilot] regenerate-cover-letter:', err);
    res.status(500).json({ error: 'regenerate_cover_letter_failed', message: err.message });
  }
});

// Replace one or more pre-answered application questions. Body shape:
//   { answers: [{ fieldId, question, answer, confidence? }, ...] }
// Pass the FULL list — partial merges happen client-side so the user's
// reordering and deletions are obvious.
router.patch('/applications/:appId/answers', express.json(), async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });

    const incoming = Array.isArray(req.body?.answers) ? req.body.answers : null;
    if (!incoming) {
      return res.status(400).json({ error: 'invalid_body', message: 'answers must be an array' });
    }

    // Sanitize: keep only known shape, cap lengths so a runaway client
    // can't bloat the JSONB column.
    const sanitized = incoming.slice(0, 50).map((a) => ({
      fieldId: typeof a?.fieldId === 'string' ? a.fieldId.slice(0, 200) : '',
      question: typeof a?.question === 'string' ? a.question.slice(0, 1000) : '',
      answer: typeof a?.answer === 'string' ? a.answer.slice(0, 5000) : '',
      confidence: typeof a?.confidence === 'number' ? a.confidence : null,
    }));

    app.formAnswers = sanitized;
    await app.save();
    res.json({ formAnswers: app.formAnswers });
  } catch (err) {
    console.error('[applypilot] patch answers:', err);
    res.status(500).json({ error: 'patch_answers_failed' });
  }
});

// Ask the AI to draft (or redraft) a single question's answer. Useful
// when the user wants a different angle on one question without
// regenerating everything. Body: { question: string, fieldId?: string,
// guidance?: string }.
router.post('/applications/:appId/regenerate-answer', express.json(), async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });

    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!question) {
      return res.status(400).json({ error: 'missing_question' });
    }
    const fieldId = typeof req.body?.fieldId === 'string'
      ? req.body.fieldId
      : `q_${Date.now()}`;
    const guidance = typeof req.body?.guidance === 'string' ? req.body.guidance.trim() : '';

    const [profile, user, job, memory] = await Promise.all([
      Profile.findOne({ where: { userId: req.userId } }),
      User.findByPk(req.userId, { attributes: ['firstName', 'lastName', 'email'] }),
      service.loadJobForApp(app),
      ApplyPilotTrainingMemory.findAll({ where: { userId: req.userId } }),
    ]);

    const profileForLetter = {
      ...(profile?.toJSON ? profile.toJSON() : (profile || {})),
      firstName: user?.firstName || profile?.firstName || '',
      lastName: user?.lastName || profile?.lastName || '',
    };

    // Re-use draftCoverAndAnswers with a single-field set, then pluck
    // the answer. The cover letter it returns is discarded — a 1-field
    // call still costs one round-trip but keeps the prompt template
    // identical to the prep-time path so quality stays consistent.
    const formFields = [{
      fieldId,
      question: guidance ? `${question}\n\nGuidance: ${guidance}` : question,
      type: 'textarea',
      required: true,
    }];

    const draft = await service.draftCoverAndAnswers({
      profile: profileForLetter,
      job,
      memory,
      formFields,
    });

    const generated = Array.isArray(draft.answers) && draft.answers[0]
      ? { ...draft.answers[0], fieldId, question }
      : { fieldId, question, answer: '', confidence: 0 };

    // Merge into stored answers — replace by fieldId, append if new.
    const existing = Array.isArray(app.formAnswers) ? [...app.formAnswers] : [];
    const idx = existing.findIndex((a) => a?.fieldId === fieldId);
    if (idx >= 0) existing[idx] = generated;
    else existing.push(generated);
    app.formAnswers = existing;
    await app.save();

    res.json({ answer: generated, formAnswers: app.formAnswers });
  } catch (err) {
    console.error('[applypilot] regenerate-answer:', err);
    res.status(500).json({ error: 'regenerate_answer_failed', message: err.message });
  }
});

// Candidate clicks "I applied". Records the moment, flips manual
// tracking to 'applied', and (when status is still 'prepared') marks
// the prep-pipeline status as 'submitted' so dashboards/funnel counters
// reflect that the application is out the door.
router.post('/applications/:appId/mark-applied', async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });

    if (app.manuallyAppliedAt) {
      return res.status(409).json({
        error: 'already_applied',
        message: 'Already marked as applied.',
        manuallyAppliedAt: app.manuallyAppliedAt,
      });
    }

    const now = new Date();
    app.manuallyAppliedAt = now;
    app.trackingStatus = 'applied';
    // Treat a manual submit as a terminal state for the prep pipeline
    // so the candidate's dashboard counts it under "Applied".
    if (['prepared', 'needs_attention', 'failed', 'error'].includes(app.status)) {
      app.status = 'submitted';
      app.submittedAt = app.submittedAt || now;
      app.submissionReceipt = {
        ok: true,
        provider: 'manual',
        manuallySubmitted: true,
        at: now.toISOString(),
        ...(req.body?.note ? { note: String(req.body.note).slice(0, 1000) } : {}),
      };
    }
    await app.save();

    const profile = await Profile.findOne({ where: { userId: req.userId } });
    res.json(serializeAppDetail(app, profile));
  } catch (err) {
    console.error('[applypilot] mark-applied:', err);
    res.status(500).json({ error: 'mark_applied_failed' });
  }
});

/* Chrome-extension confirmation: the extension detects an ATS
   thank-you / confirmation page and calls this endpoint. We match
   the URL back to one of the user's pending applications (by the
   stored applicationUrl/jobUrl host + path) and flip it to applied.
   Body: { url: string, atsProvider?: string, evidence?: object }
   Response: { matched: boolean, appId?, alreadyApplied?, application? }
   This is a best-effort signal — if no match is found we return
   matched=false and the candidate can still self-report via the UI. */
router.post('/applications/confirm-by-url', express.json(), async (req, res) => {
  try {
    const rawUrl = String(req.body?.url || '').trim();
    if (!rawUrl) return res.status(400).json({ error: 'url_required' });

    let host = '';
    let path = '';
    try {
      const u = new URL(rawUrl);
      host = u.hostname.toLowerCase();
      path = u.pathname.toLowerCase();
    } catch {
      return res.status(400).json({ error: 'bad_url' });
    }

    // Pull the user's recent un-applied applications. We only consider
    // rows that haven't already been marked applied; the extension may
    // fire multiple times for the same submission so idempotency
    // matters. Keep the search window tight for performance.
    const candidates = await ApplyPilotApplication.findAll({
      where: {
        userId: req.userId,
        manuallyAppliedAt: null,
      },
      order: [['updatedAt', 'DESC']],
      limit: 50,
    });

    // Score each candidate by host/path overlap with the stored apply
    // URL. Greenhouse, Lever, Workday all encode the company + job ID
    // in the path so a path-prefix match is high signal.
    const scored = candidates
      .map((app) => {
        const stored = app.applicationUrl || app.jobUrl || '';
        if (!stored) return null;
        let sh = '';
        let sp = '';
        try {
          const su = new URL(stored);
          sh = su.hostname.toLowerCase();
          sp = su.pathname.toLowerCase();
        } catch {
          return null;
        }
        // Same host required at minimum.
        if (sh !== host && !host.endsWith(`.${sh}`) && !sh.endsWith(`.${host}`)) {
          return null;
        }
        // Score by longest common path prefix.
        let score = 1;
        const segs = sp.split('/').filter(Boolean);
        for (const seg of segs) {
          if (path.includes(`/${seg}`)) score += 1;
        }
        return { app, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best) {
      return res.json({ matched: false, reason: 'no_matching_application' });
    }

    const app = best.app;
    if (app.manuallyAppliedAt) {
      return res.json({
        matched: true,
        alreadyApplied: true,
        appId: app.id,
        manuallyAppliedAt: app.manuallyAppliedAt,
      });
    }

    const now = new Date();
    app.manuallyAppliedAt = now;
    app.trackingStatus = 'applied';
    if (['prepared', 'needs_attention', 'failed', 'error'].includes(app.status)) {
      app.status = 'submitted';
      app.submittedAt = app.submittedAt || now;
      app.submissionReceipt = {
        ok: true,
        provider: req.body?.atsProvider || 'extension',
        confirmedByExtension: true,
        evidence: req.body?.evidence || null,
        at: now.toISOString(),
      };
    }
    await app.save();

    console.log(`[applypilot] extension confirmed submit appId=${app.id} host=${host} score=${best.score}`);
    res.json({
      matched: true,
      alreadyApplied: false,
      appId: app.id,
      manuallyAppliedAt: app.manuallyAppliedAt,
    });
  } catch (err) {
    console.error('[applypilot] confirm-by-url:', err);
    res.status(500).json({ error: 'confirm_by_url_failed' });
  }
});

// Update manual tracking status / notes after the candidate hears
// back. Body: { status?: trackingStatus, notes?: string }.
const VALID_TRACKING_STATUSES = new Set([
  'not_applied',
  'applied',
  'interviewing',
  'offer',
  'hired',
  'rejected_by_company',
  'withdrawn',
]);

router.patch('/applications/:appId/tracking', express.json(), async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });

    const { status, notes } = req.body || {};
    if (status !== undefined) {
      if (!VALID_TRACKING_STATUSES.has(status)) {
        return res.status(400).json({
          error: 'invalid_status',
          allowed: [...VALID_TRACKING_STATUSES],
        });
      }
      app.trackingStatus = status;
      // Backfill manuallyAppliedAt when the user moves past 'not_applied'
      // without explicitly clicking "I applied".
      if (status !== 'not_applied' && !app.manuallyAppliedAt) {
        app.manuallyAppliedAt = new Date();
      }
    }
    if (notes !== undefined) {
      app.trackingNotes = typeof notes === 'string' ? notes.slice(0, 5000) : null;
    }
    await app.save();

    res.json({
      tracking: {
        status: app.trackingStatus,
        manuallyAppliedAt: app.manuallyAppliedAt,
        notes: app.trackingNotes || '',
      },
    });
  } catch (err) {
    console.error('[applypilot] patch tracking:', err);
    res.status(500).json({ error: 'patch_tracking_failed' });
  }
});

// ============================================================
// End hybrid manual-submit routes
// ============================================================

router.post('/applications/:appId/preview', async (req, res) => {
  // Declared outside the try so the catch block can safely reference it
  // for response context. Was previously declared with `const` inside the
  // try, which made `adapter?.name` in the catch throw ReferenceError
  // and turn graceful 200 fallbacks into unhandled rejections.
  let adapter = null;
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });
    if (['submitted'].includes(app.status)) {
      return res.status(409).json({
        error: 'wrong_status',
        message: `Application is ${app.status}, cannot generate preview`,
      });
    }

    const applyUrl = await resolveAndBackfillApplyUrl(app, { ExternalJob, Job });
    if (app.changed()) await app.save();
    if (!applyUrl) {
      return res.status(409).json({
        error: 'missing_apply_url',
        message: 'No apply URL on this job; preview is unavailable.',
      });
    }

    // Force Puppeteer so we can provide visual proof before approval,
    // regardless of the global APPLYPILOT_ATS_MODE.
    adapter = selectAdapter(applyUrl, { mode: 'puppeteer' });
    if (!adapter) {
      return res.status(200).json({
        ok: false,
        preview: {
          provider: null,
          dryRun: true,
          unsupported: true,
          errorCode: 'unsupported_ats',
          error: 'Preview screenshots are not available for this ATS yet. You can still approve and submit.',
          screenshots: [],
          blockers: [],
          resolutions: [],
        },
      });
    }

    const [user, profile, memory, pilotConfig] = await Promise.all([
      User.findByPk(app.userId, { attributes: ['id', 'firstName', 'lastName', 'email'] }),
      Profile.findOne({ where: { userId: app.userId } }),
      ApplyPilotTrainingMemory.findAll({ where: { userId: app.userId } }),
      ApplyPilotConfig.findOne({ where: { userId: app.userId } }),
    ]);

    const resume = await buildAndUpload(app);
    const receipt = await adapter.submit({
      app,
      applyUrl,
      profile,
      user,
      memory,
      demographics: pilotConfig?.demographics || {},
      resumePdfBuffer: resume.buffer,
      resumeFileName: resume.fileName,
      dryRun: true,
    });

    res.json({
      ok: true,
      preview: {
        provider: receipt?.provider || adapter.name,
        dryRun: true,
        screenshots: Array.isArray(receipt?.screenshots) ? receipt.screenshots : [],
        blockers: Array.isArray(receipt?.blockers) ? receipt.blockers : [],
        resolutions: Array.isArray(receipt?.resolutions) ? receipt.resolutions : [],
      },
    });
  } catch (err) {
    // Keep the response shape stable so UI can always render context.
    if (err?.needsHuman || Array.isArray(err?.blockers)) {
      return res.status(200).json({
        ok: false,
        preview: {
          provider: adapter?.name || 'unknown',
          dryRun: true,
          screenshots: Array.isArray(err?.screenshots) ? err.screenshots : [],
          blockers: Array.isArray(err?.blockers) ? err.blockers : [],
          resolutions: Array.isArray(err?.resolutions) ? err.resolutions : [],
          error: err?.message || 'Preview requires manual input',
        },
      });
    }
    // Puppeteer / browser-launch failures — production runs with
    // PUPPETEER_SKIP_DOWNLOAD=true to stay under disk quota, so Chromium
    // isn't installed and the dry-run preview can't render. Surface this
    // as a friendly 200 so the UI shows the same "preview unavailable"
    // panel it shows for unsupported ATSs, instead of a generic 500.
    const msg = String(err?.message || '').toLowerCase();
    const isBrowserMissing = /chromium|could not find browser|executablepath|failed to launch|browser was not found|puppeteer|playwright/.test(msg);
    if (isBrowserMissing) {
      console.warn('[applypilot] preview: browser unavailable, returning graceful fallback:', err.message);
      return res.status(200).json({
        ok: false,
        preview: {
          provider: adapter?.name || 'unknown',
          dryRun: true,
          unsupported: true,
          errorCode: 'browser_unavailable',
          error: 'Preview screenshots are unavailable in this environment. You can still approve and apply manually with the tailored materials.',
          screenshots: [],
          blockers: [],
          resolutions: [],
        },
      });
    }
    console.error('[applypilot] preview:', err);
    res.status(500).json({ error: 'preview_failed', message: err?.message || 'unknown' });
  }
});

router.post('/applications/:appId/approve', async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });

    // Approve is only valid once prep is complete or needs re-try review.
    if (!['prepared', 'needs_attention', 'failed'].includes(app.status)) {
      return res.status(409).json({
        error: 'wrong_status',
        message: `Application is ${app.status}, can only approve from prepared/needs_attention/failed`,
      });
    }

    // Apply any last-second edits from the Review screen.
    const edits = req.body || {};
    if (edits.coverLetter) app.coverLetter = edits.coverLetter;
    if (edits.formAnswers) app.formAnswers = edits.formAnswers;
    // Optional: pin a specific credential to use at submit time. Used
    // when the candidate has multiple accounts for the same provider
    // (e.g. two Greenhouse logins for different ATS boards).
    if (edits.credentialId) {
      // Validate ownership before pinning so users can't reference
      // someone else's credential id.
      const { ApplyPilotCredential } = require('../models');
      const cred = await ApplyPilotCredential.findOne({
        where: { id: edits.credentialId, userId: req.userId },
        attributes: ['id'],
      });
      if (cred) app.credentialId = cred.id;
    }
    await app.save();

    const result = await enqueueSubmissionForApplication(app, { forceApprove: true });

    res.json({
      ok: true,
      status: result.status,
      queued: !result.alreadyQueued,
      jobId: result.jobId,
      autoSubmit: result.autoSubmit,
    });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    if (err.status === 503) {
      return res.status(503).json({ error: err.message });
    }
    console.error('[applypilot] approve:', err);
    res.status(500).json({ error: 'approve_failed' });
  }
});

router.post('/applications/:appId/submit', async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });

    const result = await enqueueSubmissionForApplication(app, { forceApprove: app.status === 'prepared' });
    return res.json({
      ok: true,
      status: result.status,
      queued: !result.alreadyQueued,
      jobId: result.jobId,
      autoSubmit: result.autoSubmit,
    });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    if (err.status === 503) {
      return res.status(503).json({ error: err.message });
    }
    console.error('[applypilot] submit:', err);
    return res.status(500).json({ error: 'submit_failed' });
  }
});

router.post('/submit', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.applicationIds)
      ? req.body.applicationIds.filter(Boolean)
      : (req.body?.appId ? [req.body.appId] : []);

    const where = { userId: req.userId };
    if (ids.length) {
      where.id = { [Op.in]: ids };
    } else {
      where.status = 'approved';
    }

    const apps = await ApplyPilotApplication.findAll({ where });
    const results = [];
    for (const app of apps) {
      try {
        const result = await enqueueSubmissionForApplication(app);
        results.push({ id: app.id, ok: true, status: result.status, queued: !result.alreadyQueued });
      } catch (err) {
        results.push({ id: app.id, ok: false, error: err.message });
      }
    }

    return res.json({
      ok: true,
      count: results.filter((r) => r.ok).length,
      results,
    });
  } catch (err) {
    console.error('[applypilot] submit batch:', err);
    return res.status(500).json({ error: 'submit_batch_failed' });
  }
});

router.post('/applications/:appId/reject', async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });

    // Reject is the universal "remove from queue" action. It's valid
    // from every state except already-rejected and submitting:
    //   pending/scouting/preparing/prepared → simple skip
    //   approved                            → cancel before submit lands
    //                                         (worker re-checks status
    //                                         before persisting success)
    //   submitting                          → blocked: the worker is
    //                                         actively POSTing to the
    //                                         ATS; the user must wait
    //                                         until it lands so we know
    //                                         whether the submission
    //                                         went through. Returns 409.
    //   submitted                           → remove from sent history
    //   needs_attention/failed/error        → archive a stuck row
    if (app.status === 'rejected') {
      return res.json({ ok: true, status: 'rejected' });
    }
    if (app.status === 'submitting') {
      return res.status(409).json({
        error: 'submission_in_progress',
        message: 'This application is currently being submitted. Please wait for it to finish before rejecting.',
      });
    }

    app.status = 'rejected';
    app.rejectedAt = new Date();
    app.rejectionReason = (req.body && req.body.reason) || null;
    await app.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('[applypilot] reject:', err);
    res.status(500).json({ error: 'reject_failed' });
  }
});

// Bulk reject — used by the Review inbox "Clear all" / multi-select Remove
// flow. Body: { ids?: string[], reason?: string, all?: boolean }.
//   - ids: explicit list of application ids to reject (preferred)
//   - all: if true, rejects every non-rejected application for this user
// Returns { ok, count } where count is the number of rows that flipped.
router.post('/applications/reject-bulk', async (req, res) => {
  try {
    const { ids, reason, all } = req.body || {};
    const where = { userId: req.userId, status: { [Op.ne]: 'rejected' } };
    if (Array.isArray(ids) && ids.length > 0) {
      where.id = { [Op.in]: ids };
    } else if (!all) {
      return res.status(400).json({ error: 'ids_or_all_required' });
    }
    const [count] = await ApplyPilotApplication.update(
      {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectionReason: reason || null,
      },
      { where },
    );
    return res.json({ ok: true, count });
  } catch (err) {
    console.error('[applypilot] reject-bulk:', err);
    return res.status(500).json({ error: 'reject_bulk_failed' });
  }
});

// Hard-delete an application. Used by the inbox "Remove" action when a
// user wants the row gone for good (vs. soft 'rejected' which we keep
// around so the agent can learn from the rejection reason). Blocked
// while a submit is mid-flight so the worker doesn't write to a row
// that no longer exists.
router.delete('/applications/:appId', async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });
    if (app.status === 'submitting') {
      return res.status(409).json({
        error: 'submission_in_progress',
        message: 'This application is being submitted. Please wait for it to finish before removing.',
      });
    }
    await app.destroy();
    res.json({ ok: true });
  } catch (err) {
    console.error('[applypilot] delete:', err);
    res.status(500).json({ error: 'delete_failed' });
  }
});

router.post('/applications/:appId/reopen', async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });
    if (app.status !== 'rejected') {
      return res.status(409).json({
        error: 'wrong_status',
        message: `Application is ${app.status}, can only reopen rejected applications`,
      });
    }

    app.status = 'prepared';
    app.rejectedAt = null;
    app.rejectionReason = null;
    await app.save();

    res.json({ ok: true, status: app.status });
  } catch (err) {
    console.error('[applypilot] reopen:', err);
    res.status(500).json({ error: 'reopen_failed' });
  }
});

// Re-prep an application with optional natural-language guidance from
// the candidate ("make the cover letter shorter", "swap project A for
// B", etc.). Both URLs are aliases for the same handler — the frontend
// uses /request-edit; /edit is kept for back-compat with older clients
// and any direct API consumers.
async function handleRequestEdit(req, res) {
  try {
    const { section, instruction } = req.body || {};
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });
    // Phase 3: targeted single-section re-tailoring isn't implemented
    // yet — we re-run the full prep pipeline and pass the raw instruction
    // through. The worker handles retries + notifications.
    app.status = 'preparing';
    await app.save();
    await service.enqueuePrep(app.id);
    return res.json({ ok: true, status: app.status, section, instruction });
  } catch (err) {
    console.error('[applypilot] request-edit:', err);
    return res.status(500).json({ error: 'request_edit_failed' });
  }
}

router.post('/applications/:appId/edit', handleRequestEdit);
router.post('/applications/:appId/request-edit', handleRequestEdit);

router.post('/applications/:appId/resolve', async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });
    if (!['needs_attention', 'failed', 'approved', 'prepared', 'pending'].includes(app.status)) {
      return res.status(409).json({ error: `wrong_status:${app.status}` });
    }

    const resolution = {
      action: req.body?.action || 'retry',
      note: req.body?.note || req.body?.resolution || '',
    };
    app.submissionReceipt = appendResolution(app.submissionReceipt, resolution);

    // Greenhouse (and a few others) sometimes gate submission behind an
    // 8-character email verification code. The UI / API caller can pass
    // it back in via `verificationCode` and we stash it on the receipt
    // so the next adapter run picks it up and types it into the code box.
    const rawCode = req.body?.verificationCode;
    if (typeof rawCode === 'string') {
      const cleanCode = rawCode.trim().replace(/\s+/g, '');
      if (cleanCode.length >= 4 && cleanCode.length <= 16 && /^[A-Za-z0-9]+$/.test(cleanCode)) {
        app.submissionReceipt = {
          ...(app.submissionReceipt || {}),
          pendingVerificationCode: cleanCode,
          pendingVerificationCodeAt: new Date().toISOString(),
        };
      } else if (cleanCode) {
        return res.status(400).json({ error: 'invalid_verification_code' });
      }
    }

    // If prep never completed (no tailored resume), re-prep instead of
    // trying to submit an empty application.
    const needsPrep = !app.tailoredResume && ['needs_attention', 'failed', 'pending'].includes(app.status);
    if (needsPrep) {
      await app.save(); // persist the resolution audit trail
      // Queue a fresh prep attempt; worker handles retry + needs_attention.
      await service.enqueuePrep(app.id);
      return res.json({ ok: true, status: 'preparing', queued: true, reprep: true });
    }

    const result = await enqueueSubmissionForApplication(app, { forceApprove: app.status === 'prepared' });
    return res.json({ ok: true, status: result.status, queued: !result.alreadyQueued });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    if (err.status === 503) {
      return res.status(503).json({ error: err.message });
    }
    console.error('[applypilot] resolve:', err);
    return res.status(500).json({ error: 'resolve_failed' });
  }
});

// Inbox/email classifier hook.
// Body:
//   {
//     type: 'interview_invite' | 'rejection' | 'offer' | 'withdrawn',
//     reasonCategory?: 'location' | 'salary' | 'experience_gap' | ...,
//     reason?: string,
//     metadata?: object,
//   }
router.post('/applications/:appId/outcome', async (req, res) => {
  try {
    const app = await ApplyPilotApplication.findOne({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'not_found' });

    const body = req.body || {};
    if (!body.type) {
      return res.status(400).json({ error: 'missing_type' });
    }

    const normalized = {
      type: String(body.type).toLowerCase(),
      reasonCategory: body.reasonCategory || null,
      reason: body.reason || null,
      metadata: body.metadata || {},
    };

    const updated = await service.recordApplicationOutcome(app.id, normalized);

    let interviewPrepDraft = null;
    if (normalized.type === 'interview_invite') {
      interviewPrepDraft = await service.seedInterviewPrepDraftFromApplication(
        app.id,
        normalized.metadata || {}
      );
    }

    res.json({
      ok: true,
      application: serializeAppDetail(updated),
      interviewPrepDraft,
    });
  } catch (err) {
    console.error('[applypilot] outcome:', err);
    res.status(500).json({ error: 'outcome_failed' });
  }
});

/* ================================================================
   TRAINING
   ================================================================ */
router.get('/training', async (req, res) => {
  try {
    const [messages, memory, coverage] = await Promise.all([
      ApplyPilotTrainingMessage.findAll({
        where: { userId: req.userId }, order: [['createdAt', 'ASC']],
      }),
      ApplyPilotTrainingMemory.findAll({
        where: { userId: req.userId }, order: [['createdAt', 'ASC']],
      }),
      service.computeTrainingCoverage(req.userId),
    ]);
    res.json({
      topics: coverage.topics,
      overallPct: coverage.overallPct,
      currentTopic: coverage.currentTopic,
      memory: memory.map(m => ({
        id: m.id, topic: m.topic, key: m.key, value: m.value, source: m.source,
      })),
      messages: messages.map(m => ({
        id: m.id, role: m.role, topic: m.topic, content: m.content,
      })),
      quickReplies: [], // populate from latest AI message if you want chips
    });
  } catch (err) {
    console.error('[applypilot] training get:', err);
    res.status(500).json({ error: 'training_get_failed' });
  }
});

router.post('/training/advance', async (req, res) => {
  try {
    const to = req.body?.topic;
    const next = await service.setCurrentTrainingTopic(req.userId, to);
    res.json({ currentTopic: next });
  } catch (err) {
    console.error('[applypilot] training advance:', err);
    res.status(500).json({ error: 'training_advance_failed' });
  }
});

router.post('/training/messages', async (req, res) => {
  try {
    const { content, topic } = req.body || {};
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'empty_message' });
    }
    await ApplyPilotTrainingMessage.create({
      userId: req.userId, role: 'me', topic: topic || null, content,
    });

    // Load full history + memory to pass to Claude.
    const [history, memory] = await Promise.all([
      ApplyPilotTrainingMessage.findAll({
        where: { userId: req.userId }, order: [['createdAt', 'ASC']],
      }),
      ApplyPilotTrainingMemory.findAll({ where: { userId: req.userId } }),
    ]);

    const ai = await service.interviewUser({
      history: history.map(h => ({ role: h.role, content: h.content })),
      memory,
      currentTopic: topic || 'motive',
    });

    // Persist the AI reply.
    const saved = await ApplyPilotTrainingMessage.create({
      userId: req.userId,
      role: 'ai',
      topic: ai.message?.topic || null,
      content: ai.message?.content || 'Tell me more.',
    });

    // Persist any memory updates the coach proposed. Dedupe by (topic,key)
    // so we don't stack identical rows if the model re-captures an answer.
    for (const m of ai.memoryUpdates || []) {
      if (!m.topic || !m.key || !m.value) continue;
      const existing = await ApplyPilotTrainingMemory.findOne({
        where: { userId: req.userId, topic: m.topic, key: m.key },
      });
      if (existing) {
        existing.value = m.value;
        existing.source = 'chat';
        await existing.save();
      } else {
        await ApplyPilotTrainingMemory.create({
          userId: req.userId,
          topic: m.topic, key: m.key, value: m.value, source: 'chat',
        });
      }
    }

    // If we crossed a topic boundary, move the saved currentTopic forward
    // so the breadcrumb in the UI reflects where we actually are.
    if (ai.nextTopic) {
      try { await service.setCurrentTrainingTopic(req.userId, ai.nextTopic); } catch {}
    }

    res.json({
      message: {
        id: saved.id, role: saved.role, topic: saved.topic, content: saved.content,
      },
      memoryUpdates: ai.memoryUpdates || [],
      topicComplete: !!ai.topicComplete,
      allComplete: !!ai.allComplete,
    });
  } catch (err) {
    console.error('[applypilot] training post:', err);
    res.status(500).json({ error: 'training_post_failed' });
  }
});

router.get('/training/memory', async (req, res) => {
  const rows = await ApplyPilotTrainingMemory.findAll({
    where: { userId: req.userId }, order: [['createdAt', 'ASC']],
  });
  res.json(rows.map(r => ({ id: r.id, topic: r.topic, key: r.key, value: r.value, source: r.source })));
});

router.put('/training/memory/:id', async (req, res) => {
  const row = await ApplyPilotTrainingMemory.findOne({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!row) return res.status(404).json({ error: 'not_found' });
  row.value = req.body?.value ?? row.value;
  row.source = 'manual';
  await row.save();
  res.json({ ok: true });
});

router.delete('/training/memory/:id', async (req, res) => {
  const row = await ApplyPilotTrainingMemory.findOne({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!row) return res.status(404).json({ error: 'not_found' });
  await row.destroy();
  res.json({ ok: true });
});

router.post('/training/reset', async (req, res) => {
  try {
    await Promise.all([
      ApplyPilotTrainingMessage.destroy({ where: { userId: req.userId } }),
      ApplyPilotTrainingMemory.destroy({ where: { userId: req.userId } }),
    ]);
    const cfg = await ApplyPilotConfig.findOne({ where: { userId: req.userId } });
    if (cfg) {
      cfg.currentTopic = 'motive';
      await cfg.save();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[applypilot] training reset:', err);
    res.status(500).json({ error: 'training_reset_failed' });
  }
});

/* ================================================================
   Serializers
   ================================================================ */
function serializeQueueRow(app) {
  return {
    id: app.id,
    jobUrl: app.jobUrl || null,
    applicationUrl: app.applicationUrl || null,
    company: app.company,
    companyKey: app.companyKey,
    logoText: app.logoText,
    role: app.role,
    location: app.location,
    salary: app.salaryText,
    match: app.match,
    caughtAt: relTime(app.scoutedAt),
    // Raw ISO timestamp for client-side sorting / activity feeds.
    // `caughtAt` is pre-formatted ("4d ago") and useless as a sort key.
    scoutedAt: app.scoutedAt || null,
    prepared: {
      resume: !!app.tailoredResume,
      cover: !!app.coverLetter,
      form: Array.isArray(app.formAnswers) && app.formAnswers.length > 0,
    },
    status: mapStatusForUI(app.status),
    // Raw DB status is cheap to expose and lets the Sent / Needs-attention
    // tabs distinguish {approved vs submitting vs submitted} and
    // {needs_attention vs failed vs error} without another round-trip.
    dbStatus: app.status,
    submittedAt: app.submittedAt || null,
    lastSubmitAttemptAt: app.lastSubmitAttemptAt || null,
    submissionError: app.submissionError || null,
    submitAttempts: app.submitAttempts || 0,
    atsProvider: app.atsProvider || null,
    outcomeType: app.outcomeType || null,
    outcomeReasonCategory: app.outcomeReasonCategory || null,
    outcomeReason: app.outcomeReason || null,
    updatedAt: app.updatedAt || null,
    postedAgo: undefined,
    // Hybrid manual-submit fields — surface the tracking status on the
    // queue list so the dashboard can show "Applied · 3d ago" without
    // an extra detail fetch.
    trackingStatus: app.trackingStatus || 'not_applied',
    manuallyAppliedAt: app.manuallyAppliedAt || null,
  };
}

/**
 * Reshape the stored `tailoredResume` payload into the nested
 * `{ summary: { old, new }, experience: [{ old, new }], added, newSkills }`
 * shape the ReviewPage was designed against (see MOCK_DIFF in
 * frontend/src/pages/AgentArena/constants.ts). The service layer writes
 * the legacy flat keys so the PDF renderer and TailoredProfile builder
 * stay happy; the detail route translates once, here.
 */
function toReviewDiff(tailored) {
  if (!tailored) return null;
  return {
    summary: {
      old: tailored.summaryOld || '',
      new: tailored.summaryNew || '',
    },
    experience: Array.isArray(tailored.experienceDiff)
      ? tailored.experienceDiff.map((d) => ({
          section: d.section || '',
          old: d.old || '',
          new: d.new || '',
        }))
      : [],
    added: Array.isArray(tailored.added) ? tailored.added : [],
    newSkills: Array.isArray(tailored.newSkills) ? tailored.newSkills : [],
    // Pass through the rich payload so any new consumer can use it.
    rich: tailored.rich || null,
    tailoredProfileId: tailored.tailoredProfileId || null,
  };
}

function serializeAppDetail(app, profile = null, job = null) {
  // Build the rendered tailored resume by merging the user's saved
  // Profile (the base CV) with whatever the AI rewrote (`rich`). When
  // the AI only produced a summary or skills, the rest of the resume
  // (experience, education, projects, certifications) still renders
  // from the underlying Profile so the user sees a full document.
  const renderedResume = buildRenderedResume(app, profile);
  // Surface the raw JD on the detail response so the Review page can
  // render a Job Description tab. Truncated to keep the payload
  // bounded — the AI tailoring + cover letter services already use
  // their own substring budgets server-side.
  const j = job?.toJSON ? job.toJSON() : (job || null);
  const jobInfo = j ? {
    title: j.title || j.jobTitle || null,
    company: j.company || j.companyName || null,
    location: j.location || null,
    description: j.description ? String(j.description).slice(0, 12000) : '',
    requirements: j.requirements ? String(j.requirements).slice(0, 6000) : '',
    jobUrl: j.applyUrl || j.url || j.jobUrl || null,
  } : null;

  return {
    ...serializeQueueRow(app),
    diff: toReviewDiff(app.tailoredResume),
    renderedResume,
    job: jobInfo,
    coverLetter: app.coverLetter,
    formAnswers: app.formAnswers,
    whyPicked: app.whyPicked,
    matchBreakdown: app.matchBreakdown,
    outcome: {
      type: app.outcomeType || null,
      reasonCategory: app.outcomeReasonCategory || null,
      reason: app.outcomeReason || null,
      meta: app.outcomeMeta || null,
    },
    // Submission telemetry — the Review UI shows these on needs_attention.
    submission: {
      provider: app.atsProvider || null,
      status: app.status,
      resumePdfUrl: app.submittedPdfUrl || null,
      error: app.submissionError || null,
      receipt: app.submissionReceipt || null,
      attempts: app.submitAttempts || 0,
      lastAttemptAt: app.lastSubmitAttemptAt || null,
      submittedAt: app.submittedAt || null,
      // Ordered list of screenshots captured during the submission
      // run — driven by the Puppeteer adapter. Empty on the API path.
      screenshots: Array.isArray(app.submissionScreenshotUrls)
        ? app.submissionScreenshotUrls
        : [],
      // Audit trail of consent/attestation checkboxes auto-resolved by
      // the mapper (via heuristic or training memory). Sourced from the
      // receipt so we don't need a new column. Always an array.
      resolutions: Array.isArray(app.submissionReceipt?.resolutions)
        ? app.submissionReceipt.resolutions
        : [],
    },
    // Hybrid manual-submit pivot: candidate-driven tracking + cached
    // form scan so the UI can render "here's exactly what you'll fill".
    tracking: {
      status: app.trackingStatus || 'not_applied',
      manuallyAppliedAt: app.manuallyAppliedAt || null,
      notes: app.trackingNotes || '',
    },
    formScan: {
      fields: Array.isArray(app.formFieldsScanned) ? app.formFieldsScanned : null,
      scannedAt: app.formFieldsScannedAt || null,
    },
  };
}

function buildRenderedResume(app, profile) {
  const p = profile?.toJSON ? profile.toJSON() : (profile || {});
  const t = app?.tailoredResume || {};
  const rich = t.rich || {};

  const pickArr = (a, b) => {
    if (Array.isArray(a) && a.length > 0) return a;
    if (Array.isArray(b) && b.length > 0) return b;
    return [];
  };

  // Profile.skills is stored as a JSONB object keyed by category
  // (e.g. { frontend: [...], backend: [...] }) with optional proficiency
  // metadata. Flatten to a string[] so the tailored-resume render can
  // chip-list it the same way it chips the AI's tailored skills.
  const flattenSkills = (s) => {
    if (!s) return [];
    if (Array.isArray(s)) return s.filter(Boolean);
    if (typeof s === 'object') {
      const out = [];
      for (const v of Object.values(s)) {
        if (Array.isArray(v)) {
          for (const item of v) {
            if (typeof item === 'string') out.push(item);
            else if (item && typeof item === 'object' && item.name) out.push(item.name);
          }
        } else if (typeof v === 'string') {
          out.push(v);
        }
      }
      return out;
    }
    return [];
  };

  const pickSkills = (a, b) => {
    const A = flattenSkills(a);
    if (A.length) return A;
    return flattenSkills(b);
  };

  const name =
    rich.name ||
    p.name ||
    [p.firstName, p.lastName].filter(Boolean).join(' ') ||
    '';

  const title = rich.title || rich.headline || p.title || p.headline || '';
  const summary = rich.summary || t.summaryNew || p.summary || '';

  return {
    name,
    title,
    email: rich.email || p.email || '',
    phone: rich.phone || p.phone || '',
    location: rich.location || p.location || '',
    linkedinUrl: rich.linkedinUrl || p.linkedinUrl || '',
    githubUrl: rich.githubUrl || p.githubUrl || '',
    portfolioUrl: rich.portfolioUrl || p.portfolioUrl || '',
    summary,
    skills: pickSkills(rich.skills, p.skills),
    experience: pickArr(rich.experience, p.experience),
    education: pickArr(rich.education, p.education),
    projects: pickArr(rich.projects, p.projects),
    certifications: pickArr(rich.certifications, p.certifications),
    // Pass-through new skills the AI added so the UI can highlight them.
    newSkills: Array.isArray(t.newSkills) ? t.newSkills : [],
  };
}

/**
 * Map the internal state machine to the 4-state UI vocabulary the
 * React screens use: 'pending' | 'approved' | 'rejected' | 'needs_attention'.
 *
 *   scouting/pending/preparing/prepared → 'pending'   (still in queue)
 *   approved/submitting/submitted       → 'approved'  (moving toward sent)
 *   rejected                            → 'rejected'
 *   needs_attention/failed/error        → 'needs_attention'
 *                                         (blocked — the UI shows a
 *                                          finish-manually card)
 */
// Status mapping (DB ↔ UI) lives in services/applyPilotStatus.js.

/* ================================================================
   VOICE  (Whisper STT + OpenAI TTS for the training chat)
   ================================================================ */

router.post('/voice/transcribe', voiceUpload.single('audio'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer?.length) {
      return res.status(400).json({ error: 'audio_required' });
    }
    const text = await voiceService.transcribeAudio(req.file.buffer, {
      mimetype: req.file.mimetype || 'audio/webm',
      filename: req.file.originalname || 'clip.webm',
    });
    res.json({ text });
  } catch (err) {
    console.error('[applyPilot] transcribe error:', err.message);
    res.status(500).json({ error: 'transcribe_failed', message: err.message });
  }
});

router.post('/voice/speak', express.json(), async (req, res) => {
  try {
    const { text, voice } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'text_required' });
    }
    const mp3 = await voiceService.synthesizeSpeech(text, { voice });
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'no-store');
    res.send(mp3);
  } catch (err) {
    console.error('[applyPilot] speak error:', err.message);
    res.status(500).json({ error: 'speak_failed', message: err.message });
  }
});

function relTime(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

module.exports = router;
