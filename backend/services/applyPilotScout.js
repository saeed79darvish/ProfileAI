/**
 * ApplyPilot scout — runs on a schedule (node-cron) to discover new
 * jobs worth surfacing for each running user.
 *
 * Flow:
 *   for each user with state='running':
 *     pull profile + criteria
 *     pull candidate jobs (from Jobs + ExternalJobs published in the
 *       last 7 days, minus already-seen jobs for this user)
 *     score each via scoreJob()
 *     insert ApplyPilotApplication rows for match >= threshold
 *     kick off prep (async) for each new row
 *
 * Keep this cheap: small batches, bail early, respect dailyLimit.
 */
const { Op, literal } = require('sequelize');
const {
  ApplyPilotConfig,
  ApplyPilotApplication,
  Profile,
  Job,
  ExternalJob,
} = require('../models');
const service = require('./applyPilotService');
const {
  scoreJob: scoreJobDeterministic,
  buildProfileScoringData,
} = require('./jobRelevanceService');

/**
 * Build a Sequelize `where` clause from a config's criteria. Mirrors the
 * match-preview endpoint so the scout only considers jobs the user
 * actually wants — same titles, seniority, locations, salary, workstyle.
 */
function buildCriteriaWhere(criteria = {}) {
  const {
    roleTitles = [],
    seniority = [],
    workstyle = [],
    locations = [],
    salaryFloorK = 0,
    allowFederal = false,
  } = criteria;

  const and = [];
  // Federal / clearance roles — many U.S. defense / federal contractor
  // postings require active security clearance or U.S. citizenship that
  // most candidates can't satisfy. Skip by default; only include when
  // the user has explicitly opted in.
  //
  // PERF: only scan TITLES. NOT ILIKE on the description column with a
  // ~17-keyword chain is a sequential scan that takes seconds even on a
  // warm cache (this is the same fix already applied in routes/applyPilot.js
  // match-preview — comment there explains the cost). With the scout
  // already running 200-row title ILIKE OR chains, adding the description
  // NOT ILIKE on top reliably blew Render's statement_timeout. Federal /
  // clearance roles overwhelmingly say so in the title; the small miss
  // rate is worth not wedging the scout cron.
  if (!allowFederal) {
    const FEDERAL_KEYWORDS = [
      'security clearance', 'active clearance', 'ts/sci', 'top secret',
      'secret clearance', 'public trust', 'polygraph',
      'u.s. citizen', 'us citizen', 'usa citizen', 'citizenship required',
      'department of defense', 'dod ', 'federal contractor', 'usajobs',
      'gs-1', 'gs-2',
    ];
    and.push({
      [Op.and]: FEDERAL_KEYWORDS.map(kw => ({
        title: { [Op.notILike]: `%${kw}%` },
      })),
    });
  }
  if (Array.isArray(roleTitles) && roleTitles.length) {
    // Each roleTitle the user enters (e.g. "Senior Frontend Full-Stack
    // Software Engineer") is rarely the literal title of any posting.
    // Tokenize into useful sub-phrases so we OR-match the way recruiters
    // actually write titles. We keep both the full phrase (for users who
    // really do paste an exact title) and a curated set of role keywords.
    const ROLE_KEYWORDS = [
      'frontend', 'front-end', 'front end',
      'backend', 'back-end', 'back end',
      'full stack', 'full-stack', 'fullstack',
      'software engineer', 'software engineering',
      'software developer', 'web developer',
      'platform engineer', 'product engineer', 'application engineer',
      'mobile engineer', 'ios engineer', 'android engineer',
      'data engineer', 'ml engineer', 'machine learning engineer',
      'devops', 'site reliability', 'sre', 'infrastructure engineer',
      'staff engineer', 'principal engineer', 'lead engineer',
      'tech lead', 'engineering manager',
      'react', 'typescript', 'node', 'graphql',
    ];
    const ors = [];
    const seen = new Set();
    const pushPattern = (raw) => {
      const t = String(raw || '').trim();
      if (!t) return;
      const key = t.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      ors.push({ title: { [Op.iLike]: `%${t}%` } });
    };
    for (const raw of roleTitles) {
      if (typeof raw !== 'string') continue;
      const phrase = raw.trim();
      if (!phrase) continue;
      // Original phrase as-is
      pushPattern(phrase);
      // Sub-phrase: any curated role keyword present in the user's phrase
      const lower = phrase.toLowerCase();
      for (const kw of ROLE_KEYWORDS) {
        if (lower.includes(kw)) pushPattern(kw);
      }
    }
    if (ors.length) and.push({ [Op.or]: ors });
  }
  if (Array.isArray(seniority) && seniority.length) {
    const levelMap = {
      Junior: ['entry', 'junior'],
      Mid: ['mid', 'mid-level'],
      Senior: ['senior'],
      'Staff+': ['staff', 'principal', 'lead'],
      Principal: ['principal'],
      'Lead / EM': ['lead', 'manager', 'em'],
    };
    const levels = seniority.flatMap(s => levelMap[s] || [String(s).toLowerCase()]);
    if (levels.length) {
      // Most harvested ExternalJob rows have experienceLevel = NULL because
      // ATS feeds rarely surface a structured seniority. Treat NULL as
      // "unknown — let the deterministic scorer decide" rather than
      // dropping the row outright; the scorer already infers level from
      // title tokens like "Senior" / "Staff" / "Principal".
      and.push({
        [Op.or]: [
          { experienceLevel: { [Op.iLike]: { [Op.any]: levels.map(l => `%${l}%`) } } },
          { experienceLevel: null },
        ],
      });
    }
  }
  if (Array.isArray(workstyle) && workstyle.length) {
    const types = workstyle
      .map(w => String(w).toLowerCase().replace(/[^a-z]/g, ''))
      .filter(w => ['remote', 'hybrid', 'onsite'].includes(w));
    if (types.length) and.push({ locationType: { [Op.in]: types } });
  }
  if (Array.isArray(locations) && locations.length) {
    // Expand metro aliases (SF → whole Bay Area, NYC → boroughs, etc.)
    // so a single chip surfaces every posting in the region. Mirrors
    // the match-preview endpoint.
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
        raw.split(/[,/]/).map(p => p.trim()).filter(p => p.length >= 2)
          .forEach(p => {
            const aliases = METRO_ALIASES[p.toLowerCase()];
            if (aliases) aliases.forEach(a => expanded.add(a));
            else expanded.add(p);
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
        { [Op.and]: [{ salaryMin: null }, { salaryMax: null }] },
      ],
    });
  }
  return and;
}

// Scoring is deterministic + in-memory (no LLM, no per-job DB hit), so
// the cost of evaluating more candidates is negligible. We were capping
// at 30 newest jobs, which meant: once those 30 were either surfaced or
// scored below threshold, scout permanently "paused" — even though
// older jobs in the same lookback window might score higher. Bumping to
// 200 lets scout consider essentially the entire eligible pool for a
// typical user (most criteria filters narrow down to <200 rows).
const BATCH_JOBS_PER_USER = 200;
const LOOKBACK_DAYS = 7;
const DEFAULT_REAPPLY_COOLDOWN_DAYS = 45;
const TERMINAL_STATUSES = new Set(['submitted', 'rejected', 'failed', 'needs_attention', 'error']);
// Only sources where auto-submit can actually complete today. Amazon is
// deliberately excluded until we ship auth/credential handling — every
// Amazon job currently fails (login wall or expired URL → search page
// redirect), which just spams the Needs-attention tab.
const SUPPORTED_EXTERNAL_SOURCES = ['greenhouse', 'lever', 'ashby'];

function resolveJobUrl(job) {
  return job?.sourceUrl || job?.jobUrl || job?.externalUrl || job?.applyUrl || null;
}

function resolveApplicationUrl(job) {
  return job?.applyUrl || job?.externalUrl || job?.sourceUrl || job?.jobUrl || null;
}

function inferAtsProvider({ job, kind, applicationUrl, jobUrl }) {
  if (kind === 'external' && job?.source) return String(job.source).toLowerCase();
  const url = String(applicationUrl || jobUrl || '').toLowerCase();
  if (!url) return null;
  if (url.includes('greenhouse')) return 'greenhouse';
  if (url.includes('lever.co')) return 'lever';
  if (url.includes('ashbyhq.com')) return 'ashby';
  if (url.includes('workable.com')) return 'workable';
  if (url.includes('smartrecruiters.com')) return 'smartrecruiters';
  if (url.includes('myworkdayjobs.com') || url.includes('/workday/')) return 'workday';
  if (url.includes('taleo.net')) return 'taleo';
  if (url.includes('icims.com')) return 'icims';
  return 'custom';
}

function isWithinCooldown(app, cutoff) {
  const anchor = app.submittedAt || app.rejectedAt || app.updatedAt || app.createdAt;
  if (!anchor) return false;
  return new Date(anchor).getTime() >= cutoff.getTime();
}

async function runScout() {
  const configs = await ApplyPilotConfig.findAll({ where: { state: 'running' } });
  for (const cfg of configs) {
    try {
      await scoutForUser(cfg);
    } catch (err) {
      console.error(`[applypilot scout] user=${cfg.userId}`, err.message);
      // Surface the crash on the dashboard too so it isn't invisible.
      try {
        await persistScoutFunnel(cfg, {
          eligible: 0, surfaced: 0, above: 0, below: 0,
          fallback: 0, noUrl: 0,
          threshold: cfg.criteria?.matchThreshold ?? 70,
          dailyCount: 0,
          dailyLimit: cfg.criteria?.dailyLimit ?? 10,
          reason: 'scout_error',
          error: String(err?.message || err).slice(0, 240),
        });
      } catch {
        /* best-effort */
      }
    }
  }
}

/**
 * Persist the most recent scout-cycle funnel onto the config row so the
 * dashboard can explain *why* the queue is empty. Best-effort: a failed
 * write must never break the scout loop.
 */
async function persistScoutFunnel(cfg, snapshot) {
  try {
    cfg.lastScoutRun = { ranAt: new Date().toISOString(), ...snapshot };
    cfg.changed('lastScoutRun', true);
    await cfg.save({ fields: ['lastScoutRun'] });
  } catch (err) {
    console.warn(`[applypilot scout] persistFunnel skipped user=${cfg.userId}:`, err.message);
  }
}

async function scoutForUser(cfg) {
  const userId = cfg.userId;
  const threshold = cfg.criteria?.matchThreshold ?? 70;
  const dailyLimit = cfg.criteria?.dailyLimit ?? 10;
  const reapplyCooldownDays = cfg.criteria?.reapplyCooldownDays ?? DEFAULT_REAPPLY_COOLDOWN_DAYS;
  const cooldownCutoff = new Date(Date.now() - reapplyCooldownDays * 24 * 3600 * 1000);
  const outcomeFeedback = await service.getOutcomeFeedback(userId);

  // Respect the daily cap: if we've already queued/submitted `dailyLimit`
  // in the last 24h, skip this user.
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const recentCount = await ApplyPilotApplication.count({
    where: { userId, createdAt: { [Op.gte]: dayAgo } },
  });
  if (recentCount >= dailyLimit) {
    await persistScoutFunnel(cfg, {
      eligible: 0, surfaced: 0, above: 0, below: 0,
      fallback: 0, noUrl: 0,
      threshold, dailyCount: recentCount, dailyLimit,
      reason: 'daily_limit_hit',
    });
    return;
  }

  const profile = await Profile.findOne({ where: { userId } });
  if (!profile) {
    await persistScoutFunnel(cfg, {
      eligible: 0, surfaced: 0, above: 0, below: 0,
      fallback: 0, noUrl: 0,
      threshold, dailyCount: recentCount, dailyLimit,
      reason: 'no_profile',
    });
    return;
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000);

  // Apply the user's criteria so we don't waste LLM scoring budget on
  // jobs in the wrong city, wrong title, or below their salary floor.
  const criteriaAnd = buildCriteriaWhere(cfg.criteria || {});
  const externalWhere = {
    createdAt: { [Op.gte]: since },
    source: { [Op.in]: SUPPORTED_EXTERNAL_SOURCES },
    isActive: true,
  };
  if (criteriaAnd.length) externalWhere[Op.and] = criteriaAnd;

  // Pull candidate jobs — prefer ExternalJob harvest, fall back to Jobs.
  // Order by COALESCE(postedAt, createdAt) so Greenhouse jobs (postedAt = NULL
  // by design) intermix correctly with other-source jobs by their real
  // posting date — same ordering the candidate-facing Jobs page uses.
  const [externalJobs, internalJobs] = await Promise.all([
    ExternalJob.findAll({
      where: externalWhere,
      order: [literal('"ExternalJob"."effectivePostedAt" DESC NULLS LAST')],
      limit: BATCH_JOBS_PER_USER,
    }),
    Job.findAll({
      where: { createdAt: { [Op.gte]: since }, status: 'active' },
      order: [['createdAt', 'DESC']],
      limit: BATCH_JOBS_PER_USER,
    }),
  ]);

  // De-dupe against anything we already surfaced for this user.
  const alreadySurfaced = await ApplyPilotApplication.findAll({
    where: { userId },
    attributes: [
      'jobId',
      'externalJobId',
      'status',
      'createdAt',
      'updatedAt',
      'submittedAt',
      'rejectedAt',
    ],
  });

  const seenInternal = new Set();
  const seenExternal = new Set();
  for (const a of alreadySurfaced) {
    const terminal = TERMINAL_STATUSES.has(a.status);
    const shouldBlock = !terminal || isWithinCooldown(a, cooldownCutoff);
    if (!shouldBlock) continue;
    if (a.jobId) seenInternal.add(a.jobId);
    if (a.externalJobId) seenExternal.add(a.externalJobId);
  }

  const candidates = [
    ...externalJobs
      .filter(j => !seenExternal.has(j.id))
      .map(j => ({ job: j, kind: 'external' })),
    ...internalJobs
      .filter(j => !seenInternal.has(j.id))
      .map(j => ({ job: j, kind: 'internal' })),
  ].slice(0, BATCH_JOBS_PER_USER);

  // Deterministic relevance ranking — same algorithm AND same ordering
  // the candidate-facing Jobs page uses for its "Recommended" rail and
  // top-of-list (see jobRelevanceService.rankJobs):
  //   • Scoring: skills 35% / title 30% / level 15% / location 15% / recency 5%.
  //   • Sort:  fresh bucket first (jobs <24h), then by match × recency factor,
  //           then by raw recency as tiebreak.
  // The fresh bucket + recency-weighted rank score keep ApplyPilot from
  // surfacing stale-but-slightly-higher matches over fresh-and-relevant
  // ones, which used to make the queue feel "out of date" relative to
  // what the user already sees on /jobs.
  const profileData = buildProfileScoringData(profile);
  const FRESH_MS = 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const scored = candidates.map(({ job, kind }) => {
    const jobPlain = job.toJSON ? job.toJSON() : job;
    const { score: relevanceScore, matchDetails } = scoreJobDeterministic(jobPlain, profileData);
    const anchor = jobPlain.effectivePostedAt || jobPlain.postedAt || jobPlain.createdAt;
    const anchorMs = anchor ? new Date(anchor).getTime() : 0;
    // Mirrors jobRelevanceService.scoreJob's recency factor:
    //   0d→1.0, 3d→~0.89, 7d→0.75, 14d+→0.50 (floor); unknown date→0.75.
    let recencyFactor = 0.75;
    if (anchorMs > 0) {
      const daysAgo = (nowMs - anchorMs) / (1000 * 60 * 60 * 24);
      recencyFactor = Math.max(0.5, 1.0 - Math.min(daysAgo, 14) / 28);
    }
    const rankScore = relevanceScore * recencyFactor;
    const isFresh = anchorMs > 0 && (nowMs - anchorMs) < FRESH_MS;
    return { job, kind, relevanceScore, matchDetails, rankScore, isFresh, anchorMs };
  });
  // Sort: fresh bucket → rankScore DESC → raw recency DESC. Identical
  // to jobRelevanceService.rankJobs(..., { sortMode: 'recommended' }).
  scored.sort((a, b) => {
    if (a.isFresh !== b.isFresh) return (b.isFresh ? 1 : 0) - (a.isFresh ? 1 : 0);
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    return b.anchorMs - a.anchorMs;
  });

  // Funnel counters — surfaced when scout finds nothing so it's
  // obvious whether the bottleneck is criteria filters, threshold, or
  // missing apply URLs.
  let aboveThreshold = 0;
  let belowThreshold = 0;
  let noApplyUrl = 0;
  let surfaced = 0;

  // Surface only jobs at/above the user's matchThreshold. Threshold
  // acts as a hard filter for AUTO-SUBMIT: jobs that clear it are
  // eligible to be auto-applied (when approval='auto'). The
  // HARD_FLOOR (40) is the absolute minimum — below that is noise.
  //
  // Fallback for empty queue: if NOTHING clears the threshold but
  // there are decent matches >= 60, we surface up to 5 of them with
  // autoSubmitOnReady=false. The user sees them flagged in review and
  // can either approve manually or lower their threshold. This avoids
  // the silent-failure UX where the pilot looks "broken" because the
  // deterministic scorer can't reach 80% for sparse profiles.
  const HARD_FLOOR = 40;
  const FALLBACK_FLOOR = 60;
  const FALLBACK_LIMIT = 5;
  const aboveScored = scored.filter(s => s.relevanceScore >= threshold);
  const useFallback = aboveScored.length === 0;
  let fallbackUsed = 0;

  for (const { job, kind, relevanceScore, matchDetails } of scored) {
    // Budget check — don't blow past dailyLimit in a single run either.
    const inserted = await ApplyPilotApplication.count({
      where: { userId, createdAt: { [Op.gte]: dayAgo } },
    });
    if (inserted >= dailyLimit) break;

    // Build a score shape that matches what applyOutcomeFeedbackToScore expects.
    const rawScore = {
      match: relevanceScore,
      haveSkills: matchDetails?.matchedSkills || [],
      missingSkills: matchDetails?.missingSkills || [],
      rationale: `Relevance ${relevanceScore} (title ${matchDetails?.titleMatch ?? 0} / skills ${matchDetails?.skillsMatch ?? 0} / level ${matchDetails?.experienceMatch ?? 0} / location ${matchDetails?.locationMatch ?? 0} / recency ${matchDetails?.recencyBonus ?? 0})`,
      breakdown: matchDetails,
    };
    const score = service.applyOutcomeFeedbackToScore(rawScore, job, outcomeFeedback);

    if (score.match >= threshold) aboveThreshold += 1;
    else belowThreshold += 1;

    // Decide whether to surface this row.
    let surfaceMode = null; // 'normal' | 'fallback' | null
    if (score.match >= threshold) {
      surfaceMode = 'normal';
    } else if (useFallback && score.match >= FALLBACK_FLOOR && fallbackUsed < FALLBACK_LIMIT) {
      surfaceMode = 'fallback';
    }
    if (!surfaceMode) continue;
    if (score.match < HARD_FLOOR) continue;

    // Only surface jobs that can actually be submitted later.
    const applicationUrl = resolveApplicationUrl(job);
    if (!applicationUrl) {
      noApplyUrl += 1;
      continue;
    }
    const jobUrl = resolveJobUrl(job) || applicationUrl;

    const companyName = (job.company || job.companyName || '').trim();
    let row;
    try {
      row = await ApplyPilotApplication.create({
        userId,
        jobId: kind === 'internal' ? job.id : null,
        externalJobId: kind === 'external' ? job.id : null,
        jobUrl,
        applicationUrl,
        company: companyName,
        role: job.title,
        location: job.location,
        salaryText: job.salary || job.salaryRange || '',
        logoText: companyName ? companyName[0].toUpperCase() : '?',
        companyKey: guessCompanyKey(companyName),
        match: score.match,
        matchBreakdown: { ...score, belowThreshold: surfaceMode === 'fallback' },
        atsProvider: inferAtsProvider({ job, kind, applicationUrl, jobUrl }),
        status: 'pending',
        scoutedAt: new Date(),
      });
    } catch (err) {
      // Unique-index violation = a concurrent scout run (or stale
      // de-dupe set) already surfaced this job. Skip silently.
      if (err?.name === 'SequelizeUniqueConstraintError') {
        continue;
      }
      throw err;
    }

    // Hand off to the prep worker. autoSubmitOnReady=true means: when
    // prep finishes successfully and the user's config has
    // approval='auto', the worker will auto-approve and enqueue submit.
    // For fallback (below-threshold) jobs we force manual review even
    // if approval='auto'. Hybrid pivot: when APPLYPILOT_AUTOSUBMIT is
    // off (default) we never auto-submit — prep stops at 'prepared'
    // and the candidate submits manually from the UI.
    const featureFlags = require('../config/featureFlags');
    const autoSubmitOnReady = featureFlags.applyPilotAutoSubmit && surfaceMode === 'normal';
    await service.enqueuePrep(row.id, { autoSubmitOnReady });
    surfaced += 1;
    if (surfaceMode === 'fallback') fallbackUsed += 1;
  }

  // Always log the funnel — when the scout "pauses" (surfaces 0 new
  // jobs run after run) the user / operator needs to see whether the
  // bottleneck is the criteria filter (eligible=0), the relevance
  // threshold (aboveThreshold=0), or unsupported ATS URLs.
  console.log(
    `[applypilot scout] user=${userId} eligible=${scored.length} `
    + `surfaced=${surfaced} above=${aboveThreshold} below=${belowThreshold} `
    + `fallback=${fallbackUsed} noUrl=${noApplyUrl} threshold=${threshold} `
    + `dailyCount=${recentCount}/${dailyLimit}`
  );

  // Persist the funnel onto the config so the dashboard's empty-state
  // can show "we checked N jobs but none cleared your X% threshold" or
  // "tighten/loosen these criteria" instead of saying "the pilot is
  // watching" indefinitely. Classification order matches the order the
  // scout itself drops jobs.
  let reason;
  if (surfaced > 0) reason = 'surfaced';
  else if (scored.length === 0) reason = 'no_eligible_jobs';
  else if (aboveThreshold === 0 && fallbackUsed === 0) reason = 'all_below_threshold';
  else if (noApplyUrl > 0 && noApplyUrl >= scored.length) reason = 'no_apply_url';
  else reason = 'all_below_threshold';
  await persistScoutFunnel(cfg, {
    eligible: scored.length,
    surfaced,
    above: aboveThreshold,
    below: belowThreshold,
    fallback: fallbackUsed,
    noUrl: noApplyUrl,
    threshold,
    dailyCount: recentCount,
    dailyLimit,
    reason,
  });
}

function guessCompanyKey(name) {
  const n = (name || '').toLowerCase();
  const known = ['stripe', 'linear', 'figma', 'vercel', 'shopify', 'notion', 'openai', 'meta'];
  return known.find(k => n.includes(k)) || 'generic';
}

module.exports = { runScout, scoutForUser };
