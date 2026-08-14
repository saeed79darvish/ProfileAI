const express = require('express');
const router = express.Router();
const { ExternalJob, ATSBoard, Profile, Company, SavedJob, ExternalApplication, ApplyPilotApplication } = require('../models');
const authMiddleware = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const requireVerifiedEmail = require('../middleware/requireVerifiedEmail');
const { Op, literal } = require('sequelize');
const { startDateResync, getDateResyncStatus } = require('../services/externalJobService');
const { startBoardDiscovery, getBoardDiscoveryStatus } = require('../services/startupBoardDiscovery');
const { rankJobs } = require('../services/jobRelevanceService');
const { searchSimilarJobs, generateProfileQueryEmbedding, loadProfileForJobsRanking } = require('../services/jobEmbeddingService');
const cache = require('../services/simpleCache');
const { expandLocationAliases, canonicalizeLocation } = require('../utils/locationMatch');
const { buildJobSearchTsquery } = require('../utils/searchQuery');
const { normalizeJobUrl } = require('../utils/jobUrl');
const { truncateListDescriptions } = require('../utils/jobListPayload');

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Parse a comma-separated skills query param into a clean array of
 * lowercased canonical tokens. Strips empties and duplicates, caps length.
 */
function parseSkillCsv(csv) {
  if (!csv) return [];
  const raw = Array.isArray(csv) ? csv.join(',') : String(csv);
  const out = [];
  const seen = new Set();
  for (const s of raw.split(',')) {
    const tok = s.trim().toLowerCase();
    if (!tok || tok.length > 60) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
    if (out.length >= 12) break; // hard cap — over-filtering would empty the list
  }
  return out;
}

/**
 * Build a jsonb array literal safe for embedding via Sequelize literal().
 * Each token is JSON-encoded individually (handles quotes, backslashes,
 * unicode), then wrapped in PostgreSQL-quoted single quotes.
 *   ["react","node.js"]  →  '["react","node.js"]'
 */
function formatJsonbStringArrayLiteral(tokens) {
  // JSON.stringify already escapes correctly for JSON inside JSONB.
  // We just need to escape single quotes for the SQL literal wrapper.
  const json = JSON.stringify(tokens);
  return `'${json.replace(/'/g, "''")}'`;
}

/**
 * Build a cache key for a /external-jobs request. Includes the user id
 * (rankings differ per profile), pagination, search, sort, and every
 * filter that affects the SQL WHERE clause.
 */
/**
 * Cache key for the COUNT that backs pagination.
 *
 * Deliberately excludes page, limit, sort AND user: the number of jobs matching
 * a filter set is identical for every user and on every page, so a single entry
 * serves all of them. That is what makes it worth separating from the page
 * fetch — the count is the slow half, and it is also the half that is shared.
 */
function buildJobsCountCacheKey(q) {
  const skills = parseSkillCsv(q.skills).slice().sort().join(',');
  const norm = {
    s: q.search ? String(q.search).trim().toLowerCase() : '',
    rh: q.roleHint ? String(q.roleHint).trim().toLowerCase() : '',
    lt: q.locationType || '',
    lo: q.location ? String(q.location).trim().toLowerCase() : '',
    et: q.employmentType || '',
    el: q.experienceLevel || '',
    sm: q.salaryMin || '',
    sx: q.salaryMax || '',
    co: q.company ? String(q.company).trim().toLowerCase() : '',
    de: q.department ? String(q.department).trim().toLowerCase() : '',
    dp: q.datePosted || '',
    sk: skills,
    src: q.source || '',
    st: String(q.startup || '').toLowerCase() === 'true' ? '1' : '',
    hs: String(q.hideStale || '').toLowerCase() === 'true' ? '1' : '',
  };
  // NOT under the `external_jobs:` prefix, deliberately.
  //
  // Every board sync that changes anything calls
  // cache.invalidatePrefix('external_jobs:'), and with hundreds of boards a
  // sync is almost always in flight — so a count stored under that prefix was
  // wiped before it could ever be reused, and the cache never once hit in
  // production. The 60s TTL is the right bound here anyway: a total that is up
  // to a minute stale is invisible in a "N jobs" label, whereas recomputing a
  // COUNT over the whole corpus on every request is not.
  return `jobscount:${Object.entries(norm).map(([k, v]) => `${k}=${v}`).join('|')}`;
}

function buildJobsListCacheKey(userId, q) {
  // Normalize keys + values so trivial differences (case, spacing) hit the
  // same cache entry. Skills are sorted so "react,node" and "node,react"
  // deduplicate.
  const skills = parseSkillCsv(q.skills).slice().sort().join(',');
  const norm = {
    u: String(userId || ''),
    p: String(q.page || 1),
    l: String(q.limit || 20),
    s: q.search ? String(q.search).trim().toLowerCase() : '',
    rh: q.roleHint ? String(q.roleHint).trim().toLowerCase() : '',
    so: normalizeSortMode(q.sort),
    lt: q.locationType || '',
    lo: q.location ? String(q.location).trim().toLowerCase() : '',
    et: q.employmentType || '',
    el: q.experienceLevel || '',
    sm: q.salaryMin || '',
    sx: q.salaryMax || '',
    co: q.company ? String(q.company).trim().toLowerCase() : '',
    de: q.department ? String(q.department).trim().toLowerCase() : '',
    dp: q.datePosted || '',
    sk: skills,
    src: q.source || '',
    st: String(q.startup || '').toLowerCase() === 'true' ? '1' : '',
    hs: String(q.hideStale || '').toLowerCase() === 'true' ? '1' : '',
  };
  return `external_jobs:list:${Object.entries(norm).map(([k, v]) => `${k}=${v}`).join('|')}`;
}

/**
 * Pull the profile's skills into a flat lowercased Set. Handles both the
 * structured shape ({frontend: [...], backend: [...]}) and the legacy
 * array shape. Used to compute matchedSkills for semantic results.
 */
function extractProfileSkillSet(profile) {
  const out = new Set();
  if (!profile) return out;
  const raw = profile.skills;
  if (!raw) return out;
  if (Array.isArray(raw)) {
    for (const s of raw) {
      const v = (typeof s === 'string' ? s : (s?.name || '')).toLowerCase().trim();
      if (v) out.add(v);
    }
  } else if (typeof raw === 'object') {
    for (const arr of Object.values(raw)) {
      if (!Array.isArray(arr)) continue;
      for (const s of arr) {
        const v = (typeof s === 'string' ? s : (s?.name || '')).toLowerCase().trim();
        if (v) out.add(v);
      }
    }
  }
  return out;
}

/**
 * Intersect a profile-skill Set with a job's skills array. Returns the
 * canonical (job-side) string for each match, deduped, lowercased.
 */
function intersectSkills(profileSkillSet, jobSkills) {
  if (!profileSkillSet || profileSkillSet.size === 0) return [];
  if (!Array.isArray(jobSkills) || jobSkills.length === 0) return [];
  const out = [];
  const seen = new Set();
  for (const s of jobSkills) {
    const tok = String(s || '').toLowerCase().trim();
    if (!tok || seen.has(tok)) continue;
    if (profileSkillSet.has(tok)) {
      out.push(tok);
      seen.add(tok);
    }
  }
  return out;
}

/**
 * Normalize the user-facing sort parameter to a known mode.
 *
 *   'recommended' (default) — for signed-in candidates, the FRESHEST jobs
 *                        ranked by profile fit: a recency-bounded candidate
 *                        pool ordered by relevance × freshness decay. See
 *                        jobEmbeddingService.searchSimilarJobs.
 *   'recent'           — pure newest-first. The typed query's hard text filter
 *                        (title/company/dept) supplies relevance; ordering is
 *                        pure recency. Also the path anonymous visitors take,
 *                        since there's no profile to rank against.
 *   'match'            — pure profile-fit %, recency only as tiebreak. Heavier
 *                        (HNSW ANN pool); reachable via ?sort=match.
 *
 * HISTORY: 'recommended' was previously aliased to 'recent' because its old
 * implementation ran the full semantic pipeline (HNSW ANN + recency UNION,
 * per-row cosine over the corpus) and then ordered purely by recency anyway —
 * identical output at multi-second cost and frequent statement timeouts. That
 * alias meant signed-in candidates got NO personalization at all: the top of
 * the feed was whichever board synced most recently. The mode now uses a
 * bounded recency pool (index-ordered LIMIT, cosine on at most a few thousand
 * rows), which is both personalized and cheaper than the version that was
 * retired, so the alias is gone.
 */
function normalizeSortMode(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'recent' || v === 'match' || v === 'recommended') return v;
  // 'relevance' was a legacy alias for the default; missing → default.
  return 'recommended';
}

/**
 * Lightweight in-process counters for the observability endpoint.
 * Cleared on process restart; not synchronized across instances.
 */
const obsCounters = {
  listRequests: 0,
  listCacheHits: 0,
  semanticSuccesses: 0,
  semanticFailures: 0,
  keywordFallbacks: 0,
  startedAt: Date.now(),
};
function bumpCounter(key, n = 1) {
  if (typeof obsCounters[key] === 'number') obsCounters[key] += n;
}
// Exported for the observability endpoint below.
function getCountersSnapshot() {
  return { ...obsCounters, uptimeSeconds: Math.round((Date.now() - obsCounters.startedAt) / 1000) };
}

/**
 * @route   GET /api/external-jobs/digest/unsubscribe
 * @desc    One-click unsubscribe from the daily job-match digest email.
 *          Uses a stateless HMAC-signed token (no login required) so it
 *          works straight from the email footer link.
 * @access  Public
 */
router.get('/digest/unsubscribe', async (req, res) => {
  try {
    const { verifyUnsubscribeToken } = require('../services/jobDigestService');
    const { User } = require('../models');
    const userId = verifyUnsubscribeToken(req.query.token);
    if (!userId) {
      return res.status(400).send('<p>This unsubscribe link is invalid or has expired.</p>');
    }
    await User.update({ jobDigestOptOut: true }, { where: { id: userId } });
    return res.send(
      '<div style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;text-align:center;">'
      + '<h2>You\'re unsubscribed</h2>'
      + '<p>You will no longer receive the daily job-match email from ProfilleAI.</p>'
      + `<p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings">Manage your preferences</a></p>`
      + '</div>'
    );
  } catch (err) {
    console.error('[JobDigest] Unsubscribe error:', err.message);
    return res.status(500).send('<p>Something went wrong. Please try again later.</p>');
  }
});

/**
 * @route   GET /api/external-jobs
 * @desc    Get all active external jobs with search/filter/pagination.
 *          When sort=relevance, ranks jobs by candidate profile match.
 * @access  Public (anonymous visitors get recency-sorted results;
 *          logged-in candidates additionally get profile-based ranking).
 */
router.get('/', optionalAuth, async (req, res) => {
  // Per-stage timing for prod log triage. The user reported a 15s wait on
  // a default /external-jobs request; without breakdown timings we can't
  // tell whether it was the profile fetch, the ANN+rank SELECT, the
  // COUNT(*), or one of the OpenAI embedding calls. Stamps are logged
  // only when the total goes over a threshold so they don't spam logs.
  const reqStartedAt = Date.now();
  const stages = [];
  // Cumulative-ms stamps, also emitted as a Server-Timing header.
  //
  // The existing stage log only fires above a latency threshold and only lands
  // in the platform log, which is unreadable from a dev machine — so a
  // production cold-path that measured 1.5-2.9s (against ~120ms warm) could not
  // be attributed to a stage at all. Server-Timing is a standard response
  // header, so the same breakdown is now measurable with curl from anywhere,
  // and shows up natively in browser devtools for whoever is looking at a slow
  // page. Timings only; no query values, so nothing sensitive is exposed.
  const marks = [];
  const stamp = (label) => {
    stages.push(`${label}=${Date.now() - reqStartedAt}ms`);
    marks.push([label, Date.now() - reqStartedAt]);
  };
  const emitServerTiming = () => {
    try {
      if (res.headersSent) return;
      const total = Date.now() - reqStartedAt;
      const parts = marks.map(([l, ms]) => `${l};dur=${ms}`);
      parts.push(`total;dur=${total}`);
      res.set('Server-Timing', parts.join(', '));
    } catch { /* header emission must never break a response */ }
  };
  try {
    bumpCounter('listRequests');

    // Browser-side cache hint. The response is per-user (rankings differ
    // by profile), so use `private`. 30s is short enough that fresh jobs
    // surface quickly on hard reload but long enough that flicking between
    // /jobs and a detail view via the back button hits the bfcache /
    // disk cache instead of refetching. `must-revalidate` keeps stale
    // responses from being served after the window expires.
    res.set('Cache-Control', 'private, max-age=30, must-revalidate');

    // Server-side request cache. Identical (userId, search, filters, page,
    // sort) tuples reuse the prior response for 90s. Auto-invalidated on
    // every successful sync via cache.invalidatePrefix('external_jobs:').
    // 90s is long enough to coalesce a "navigate away + back" flow,
    // short enough that fresh-paged users see new jobs quickly.
    const cacheKey = buildJobsListCacheKey(req.user?.id || 'anon', req.query);
    stamp('cacheLookup');
    const cached = cache.get(cacheKey);
    if (cached) {
      bumpCounter('listCacheHits');
      // Tag the response so smoke tests / debug tooling can see cache hits.
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }
    res.set('X-Cache', 'MISS');

    // Wrap res.json once so every successful exit path through this handler
    // populates the cache without us having to touch each return statement.
    const originalJson = res.json.bind(res);
    res.json = (rawPayload) => {
      emitServerTiming();
      // Trim descriptions to a preview BEFORE caching, so every exit path
      // through this handler (semantic, keyword, plain) is covered by one
      // interception point and the server-side cache holds the small shape
      // rather than ~160KB of full job text per entry.
      const payload = truncateListDescriptions(rawPayload);
      // Don't cache error envelopes — only well-formed list responses.
      if (payload && Array.isArray(payload.jobs)) {
        cache.set(cacheKey, payload, 90 * 1000);
      }
      // Log a per-stage breakdown when a request gets visibly slow. The
      // 1500ms threshold is high enough to skip the warm hot path (~50ms)
      // and low enough to catch the multi-second outliers users feel.
      const totalMs = Date.now() - reqStartedAt;
      if (totalMs > 1500) {
        console.warn(
          `[ExternalJobs] slow GET / ${totalMs}ms ` +
          `user=${req.user?.id} stages=[${stages.join(' ')}] ` +
          `q=${JSON.stringify(req.query).slice(0, 200)}`
        );
      }
      return originalJson(payload);
    };

    const {
      search: rawSearch,
      // Role the CLIENT inferred from the candidate's profile, as opposed to
      // something they typed. It is used to RANK, never to filter.
      //
      // Seeding it into `search` (the old behaviour) made it a hard AND filter
      // on title/company/department, which is catastrophically narrow: of 743
      // San Francisco jobs posted in one week, 311 had "engineer" in the title
      // but only 4 had "frontend", and exactly 1 had both. A candidate whose
      // profile says "Frontend Engineer" therefore saw a single fresh job and
      // reasonably concluded the feed was broken — when in fact the corpus was
      // healthy and the query was excluding almost all of it.
      //
      // As a ranking signal instead, the whole fresh pool stays eligible and
      // frontend-ish roles rise to the top, including the ones titled plain
      // "Software Engineer". A term the user actually TYPED keeps its strict
      // filter semantics — that is them asking a precise question.
      roleHint: rawRoleHint,
      location,
      locationType,
      employmentType,
      experienceLevel,
      salaryMin,
      salaryMax,
      company,
      source,
      department,
      datePosted, // 'day' | 'week' | 'month'
      skills, // CSV: "react,nodejs,aws"  — jobs must contain ALL of these
      startup, // 'true' to limit to startups (HN postings + small / early-stage companies)
      sort, // 'relevance' | 'recent' (default)
      page = 1,
      limit = 20
    } = req.query;

    // Sanitize the search input. The value flows into bound parameters,
    // so SQL injection is already mitigated, but a malicious or
    // accidentally-pasted long / HTML / control-char payload would
    // otherwise:
    //   - thrash the search-embedding cache (200KB cache key churn),
    //   - cause OpenAI to reject the embedding call (8K token cap),
    //   - render as visible markup if echoed back unsanitized in error
    //     responses.
    // Strip HTML-ish brackets and ASCII control bytes, normalize whitespace,
    // and cap at 200 chars before doing anything else with the value.
    const sanitizeQueryText = (v, maxLen) => (typeof v === 'string'
      ? v
          .replace(/<[^>]*>/g, ' ')               // strip HTML tags
          .replace(/[\u0000-\u001F\u007F]/g, ' ') // strip ASCII control chars
          .replace(/\s+/g, ' ')                   // collapse whitespace
          .trim()
          .slice(0, maxLen)
      : '');

    const search = sanitizeQueryText(rawSearch, 200);
    // Ignored entirely when the user typed a real query — an explicit search
    // must never be diluted by our guess about their role.
    const roleHint = search ? '' : sanitizeQueryText(rawRoleHint, 80);

    const where = { isActive: true };
    // Replacements bag for any literal() clauses below — Sequelize escapes
    // these values when interpolating :name placeholders, so we never need
    // to hand-escape strings into SQL literals.
    const whereReplacements = {};

    // Skill filter — jobs must contain every requested skill (AND semantics).
    // Backed by the GIN index on ExternalJobs.skills (jsonb_path_ops).
    // The chip filter sends skill tokens already lowercased / canonical.
    const skillTokens = parseSkillCsv(skills);
    if (skillTokens.length > 0) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        literal(`"ExternalJob"."skills" @> ${formatJsonbStringArrayLiteral(skillTokens)}::jsonb`)
      ];
    }

    // Startup filter — board-provenance based, read from the denormalized
    // ExternalJobs.isStartup boolean (set at ingest from the source board's
    // ATSBoards.isStartup; hn_hiring rows are flagged true too). We deliberately
    // do NOT join ExternalJobs → ATSBoards here: their source/platform are
    // different enum types, and casting to compare them defeated the unique
    // (platform, boardToken) index, making the correlated EXISTS time out under
    // sync load. A plain indexed boolean keeps the COUNT + scan fast.
    //
    // We still SUBTRACT, as defense-in-depth, the curated non-startup name
    // deny-list and any company whose funding stage is late/IPO/acquired —
    // this catches a discovery-sourced company that has since grown large.
    const { NON_STARTUP_COMPANIES, NON_STARTUP_FUNDING_STAGES } = require('../utils/startupClassifier');
    const wantStartup = String(startup || '').toLowerCase() === 'true';
    if (wantStartup) {
      whereReplacements.nonStartupNames = NON_STARTUP_COMPANIES;
      whereReplacements.nonStartupStages = NON_STARTUP_FUNDING_STAGES;
      where[Op.and] = [
        ...(where[Op.and] || []),
        { [Op.or]: [{ source: 'hn_hiring' }, { isStartup: true }] },
        literal(`LOWER(COALESCE("ExternalJob"."company", '')) <> ALL(ARRAY[:nonStartupNames]::text[])`),
        literal(`NOT EXISTS (
          SELECT 1 FROM "Companies" c2
          WHERE c2.id = "ExternalJob"."companyId"
            AND LOWER(COALESCE(c2."fundingStage", '')) = ANY(ARRAY[:nonStartupStages]::text[])
        )`)
      ];
    }

    if (search) {
      // Weighted full-text search backed by ExternalJobs.searchTsvAB — a
      // STORED generated tsvector containing ONLY the title (weight A) and
      // company/department (weight B), NOT the description. See
      // scripts/migrations/ensureExternalJobPerfSchema.js.
      //
      // We require a hit in the title/company/dept, not the description.
      // Description hits are noisy — a Back-End job whose JD body happens to
      // mention "frontend" should NOT match a search for "Frontend Engineer".
      // Because searchTsvAB simply does not include the description, a single
      // GIN-indexable `@@` predicate enforces that rule for free — no per-row
      // ts_rank_cd post-filter.
      //
      // This replaced the previous `searchTsv @@ q AND ts_rank_cd(...) > 0`
      // pair: ts_rank_cd had to be evaluated per matched row for BOTH the
      // SELECT and findAndCountAll's COUNT pass, which on a common term like
      // "engineer" (thousands of matches) blew the 15s statement_timeout and
      // returned a 500. The single GIN @@ on the smaller A/B vector keeps both
      // the bitmap COUNT and the recency sort fast.
      //
      // The query string flows through Sequelize's :tsQuery replacement
      // (escaped server-side) instead of being hand-interpolated, which
      // closes the previous SQL-injection vector here.
      //
      // buildJobSearchTsquery expands role-spelling/synonym concepts
      // ("frontend" ⇄ "front end" ⇄ "front-end", "engineer" ⇄ "developer") into a
      // to_tsquery so this anonymous/recency path returns the same widened
      // result set as the signed-in searchSimilarJobs path. If sanitization
      // leaves nothing usable, skip the text filter (other filters still apply).
      const tsQuery = buildJobSearchTsquery(search);
      if (tsQuery) {
        whereReplacements.tsQuery = tsQuery;
        where[Op.and] = [
          ...(where[Op.and] || []),
          literal(`"ExternalJob"."searchTsvAB" @@ to_tsquery('english', :tsQuery)`)
        ];
      }
    }

    if (datePosted) {
      const now = new Date();
      const dateMap = {
        day: new Date(now - 24 * 60 * 60 * 1000),
        '3days': new Date(now - 3 * 24 * 60 * 60 * 1000),
        week: new Date(now - 7 * 24 * 60 * 60 * 1000),
        '2weeks': new Date(now - 14 * 24 * 60 * 60 * 1000),
        month: new Date(now - 30 * 24 * 60 * 60 * 1000),
        '3months': new Date(now - 90 * 24 * 60 * 60 * 1000),
      };
      if (dateMap[datePosted]) {
        // Greenhouse jobs intentionally store postedAt = NULL (see comment in
        // externalJobService.normalizeGreenhouseJob — Greenhouse's API only
        // exposes `updated_at` which gets bulk-stamped on every edit and is
        // not a real first-published date). Falling back to `createdAt`
        // (= first seen by us) matches what the UI label already shows.
        whereReplacements.dateCutoff = dateMap[datePosted].toISOString();
        where[Op.and] = [
          ...(where[Op.and] || []),
          literal(`"ExternalJob"."effectivePostedAt" >= :dateCutoff`)
        ];
      }
    }

    // Default freshness window. When the caller hasn't picked an explicit
    // datePosted filter, cap the feed to jobs whose effective date is within
    // the last JOBS_DEFAULT_MAX_AGE_DAYS days. Users expect a jobs board to
    // show CURRENT openings, not everything ever ingested — without this, an
    // "active" posting that's a year old (or a freshly-discovered board's whole
    // back-catalogue) sits in the list. Escape hatch: pass datePosted='all'
    // (or any value not in dateMap, e.g. '6months') to widen; the UI's date
    // options ('3months' = 90d) already widen past this default. Set
    // JOBS_DEFAULT_MAX_AGE_DAYS=0 to disable entirely.
    const defaultMaxAgeDays = parseInt(process.env.JOBS_DEFAULT_MAX_AGE_DAYS || '60', 10);
    if (!datePosted && defaultMaxAgeDays > 0) {
      const cutoff = new Date(Date.now() - defaultMaxAgeDays * 24 * 60 * 60 * 1000);
      whereReplacements.defaultDateCutoff = cutoff.toISOString();
      where[Op.and] = [
        ...(where[Op.and] || []),
        literal(`"ExternalJob"."effectivePostedAt" >= :defaultDateCutoff`)
      ];
    }

    if (location) {
      // Expand a major hub to its whole commute metro (e.g. "San Francisco"
      // also matches San Mateo / Foster City / San Jose / Bay Area) so the
      // filter doesn't drop the ~90% of in-area jobs that spell their location
      // differently. Unknown locations fall back to a single substring match.
      const locPatterns = expandLocationAliases(location);
      if (locPatterns.length > 1) {
        where.location = { [Op.or]: locPatterns.map(p => ({ [Op.iLike]: `%${p}%` })) };
      } else {
        where.location = { [Op.iLike]: `%${locPatterns[0] || location}%` };
      }
    }

    if (locationType) {
      where.locationType = locationType;
    }

    if (employmentType) {
      // LENIENT NULL policy (same rationale as the salary filter below):
      // employmentType is sparsely/unreliably populated upstream (most
      // greenhouse jobs expose no structured employment type), so an exact
      // match emptied results. Include jobs that match OR have no listed type.
      where[Op.and] = [
        ...(where[Op.and] || []),
        { [Op.or]: [{ employmentType: null }, { employmentType }] }
      ];
    }

    if (experienceLevel) {
      // LENIENT NULL policy. experienceLevel is inferred from the job title
      // and is genuinely UNKNOWN (null) whenever the title carries no
      // seniority keyword (e.g. a plain "Software Engineer"). An exact-equality
      // filter would hide all those roles from any level selection — including
      // real senior roles that simply weren't titled "Senior". So we match the
      // requested level OR an unknown level, mirroring the employmentType /
      // salary filters.
      where[Op.and] = [
        ...(where[Op.and] || []),
        { [Op.or]: [{ experienceLevel: null }, { experienceLevel }] }
      ];
    }

    // Salary band filter — LENIENT NULL policy. Only ~1.5% of the corpus
    // lists a salary (greenhouse/ashby/lever rarely expose structured pay),
    // so excluding unlisted-salary jobs emptied the result set for almost
    // any band. We instead include jobs that match the band OR have no
    // listed salary. Keep this in sync with the semantic path in
    // jobEmbeddingService.searchSimilarJobs (same OR-NULL policy).
    if (salaryMin) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        { [Op.or]: [{ salaryMax: null }, { salaryMax: { [Op.gte]: parseInt(salaryMin) } }] }
      ];
    }

    if (salaryMax) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        { [Op.or]: [{ salaryMin: null }, { salaryMin: { [Op.lte]: parseInt(salaryMax) } }] }
      ];
    }

    if (company) {
      where.company = { [Op.iLike]: `%${company}%` };
    }

    if (source) {
      where.source = source;
    }

    // "Hide stale postings" — drops listings our ghost-job scoring says are
    // probably not live vacancies (pipeline/talent-pool ads, listings alive for
    // months, dates refreshed indefinitely). Opt-in rather than default: the
    // score is a judgement call, and silently hiding a slow-to-fill role the
    // candidate wanted is worse than showing it with a caveat.
    if (String(req.query.hideStale || '').toLowerCase() === 'true') {
      const { GHOST_THRESHOLD } = require('../services/ghostJobDetector');
      where[Op.and] = [
        ...(where[Op.and] || []),
        literal(`COALESCE("ExternalJob"."ghostScore", 0) < ${GHOST_THRESHOLD}`),
      ];
    }

    if (department) {
      where.department = { [Op.iLike]: `%${department}%` };
    }

    // Clamp pagination inputs. Without bounds a client could send
    // `limit=999999` and OOM the API process by materializing a huge
    // result set, or `page=0` / negative values that produce nonsense
    // OFFSETs. 100 is more than any UI shows; 1000 pages of 100 is
    // already 100k rows which is well beyond the corpus.
    const pageNum = Math.max(1, Math.min(parseInt(page, 10) || 1, 1000));
    const limitNum = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));

    // --- Sort mode ---
    // Three user-facing modes, normalized at the top of this function:
    //   'recommended' (default) — match × recency. Sorted by rank score.
    //   'match'                 — pure match score, recency only as tiebreaker.
    //   'recent'                — pure date, match only as tiebreaker.
    // For 'recommended' and 'match' we still need the profile + embedding to
    // compute match scores; only 'recent' bypasses ranking entirely.
    //
    // Anonymous visitors have no profile to rank against, so they always get
    // the pure-recency path below regardless of the requested sort mode —
    // this keeps the jobs page public (no login required to browse) while
    // reserving profile-based ranking for signed-in candidates.
    const sortMode = normalizeSortMode(sort);
    if (sortMode !== 'recent' && req.user?.id) {
      // Cached read: skips the Profile.findOne pgvector fetch on hot path.
      // Returns { profileId, profileEmbedding, skillSet } or null.
      // See loadProfileForJobsRanking() in jobEmbeddingService for cache
      // semantics; invalidated on Profile.afterSave.
      const profileCached = await loadProfileForJobsRanking(req.user.id);
      stamp('profile');

      // A signed-in user with NO profile row (signed up but never built one)
      // has nothing to rank against, so they take the plain recency path
      // below rather than the keyword fallback. That fallback pools only 200
      // rows and reports the pool as the pagination total, which would strand
      // a profile-less user on a 200-job slice of the corpus.
      if (profileCached) {

      // --- AI Semantic Ranking via pgvector ---
      let profileEmbedding = profileCached?.profileEmbedding || null;
      if (profileCached && !profileEmbedding) {
        // Legacy profile without a persisted openaiEmbedding — kick off a
        // background regen and fall through to the keyword path for THIS
        // request. The OpenAI roundtrip is 300-800ms and would block the
        // first /jobs paint for every legacy user. We need the full
        // profile row for the regen, so fetch it lazily here (off the
        // hot path — this only runs once per legacy user).
        try {
          const { regenerateProfileOpenAIEmbedding } = require('../services/jobEmbeddingService');
          const fullProfile = await Profile.findOne({ where: { userId: req.user.id } });
          if (fullProfile) {
            regenerateProfileOpenAIEmbedding(fullProfile).catch((e) => {
              console.warn('[ExternalJobs] background profile embedding regen failed:', e.message);
            });
          }
        } catch (e) {
          console.warn('[ExternalJobs] could not schedule profile embedding regen:', e.message);
        }
      }

      if (profileEmbedding) {
        // Semantic search: pgvector cosine distance, paginated in SQL
        // When a search query is present, generate an embedding for it too
        // so we can blend search relevance with profile match.
        // Embed whichever query text we have. A typed `search` ALSO applies its
        // hard tsquery filter (below); a `roleHint` does not — it only shifts
        // the ordering, so the full fresh pool stays eligible.
        // NEVER block the response on OpenAI. This used to await the embedding
        // with a 2.5s timeout and a retry, so the first request for any term
        // whose cache entry had expired paid up to ~5s before the query even
        // started — and since the profile-derived roleHint flows through here,
        // that hit ordinary jobs-page loads, not just searches.
        //
        // The embedding only sharpens the ORDER BY: the profile vector still
        // ranks without it, and a typed search still applies its full-text
        // filter regardless. So we use it when it is already cached, and
        // otherwise render immediately and warm the cache for subsequent
        // requests.
        // No third-party call on the request path any more. The role/query text
        // is ranked lexically against the title vector inside Postgres (see
        // searchSimilarJobs), which measured far more discriminating than an
        // embedding for this purpose AND costs nothing. The profile embedding
        // still supplies the semantic signal, and it is already stored on the
        // row rather than fetched per request.
        const rankingText = search || roleHint;

        try {
          const semanticResult = await searchSimilarJobs(profileEmbedding, {
            limit: limitNum,
            offset: (pageNum - 1) * limitNum,
            locationType: locationType || null,
            location: location || null,
            search: search || null,
            rankText: rankingText || null,
            datePosted: datePosted || null,
            company: company || null,
            experienceLevel: experienceLevel || null,
            employmentType: employmentType || null,
            department: department || null,
            skills: skillTokens.length > 0 ? skillTokens : null,
            // Honor the same default freshness window as the recency/keyword
            // paths when the user hasn't chosen an explicit datePosted.
            defaultMaxAgeDays: !datePosted ? defaultMaxAgeDays : 0,
            startup: wantStartup,
            hideStale: String(req.query.hideStale || '').toLowerCase() === 'true',
            // Strict salary policy — jobs without a listed salary are
            // excluded when a band is selected. Same policy as the
            // non-semantic path below; if you change one, change both.
            salaryMin: salaryMin || null,
            salaryMax: salaryMax || null,
            // 'match' = pure relevance (no recency penalty), 'recommended' = match × recency.
            sortMode
          });

          const { rows: semanticJobs, total } = semanticResult;
          stamp('semantic');
          bumpCounter('semanticSuccesses');

          // If semantic search returns 0 rows it's almost always because
          // the corpus doesn't have embeddings populated yet (the WHERE
          // requires `embedding IS NOT NULL`). Falling through to the
          // keyword path below lets the candidate still see jobs while
          // the embedding backfill runs.
          if (total === 0) {
            console.warn('[ExternalJobs] Semantic search returned 0 rows — falling back to keyword ranking. Likely cause: jobs missing embeddings (run scripts/backfillJobEmbeddings.js).');
            bumpCounter('semanticEmptyFallbacks');
          } else {

          // Surface matchedSkills (intersection of profile skills × job
          // skills) per row so the UI can show users WHY a job ranked high.
          // The keyword path computes this internally via rankJobs; the
          // semantic path bypasses that, so we do the intersection here in
          // JS — cheap, runs only on the 20 jobs in the page response.
          const profileSkillSet = profileCached?.skillSet || new Set();
          const semanticJobsWithMatched = semanticJobs.map(j => ({
            ...j,
            matchedSkills: intersectSkills(profileSkillSet, j.skills),
          }));

      // NOTE: the request path no longer triggers crawling.
      //
      // Every listing response used to fan out refreshIfStale() per board in
      // the result set plus a corpus-freshness probe. Each of those does a DB
      // lookup before deciding to no-op, so user traffic was doing crawl
      // bookkeeping on the same undersized Postgres that was serving the
      // query — the documented cause of statement timeouts and
      // crash-into-recovery, and why the corpus self-heal already had to be
      // shipped behind a default-off kill switch.
      //
      // Freshness is owned by the 15-minute sync (ENABLE_EXTERNAL_JOBS_CRON /
      // RUN_CRON_INLINE, see render.yaml), which is where crawling belongs.

          return res.json({
            jobs: semanticJobsWithMatched,
            pagination: {
              total,
              page: pageNum,
              pages: Math.ceil(total / limitNum)
            },
            sortMethod: 'semantic'
          });
          }
        } catch (semanticError) {
          console.warn('[ExternalJobs] Semantic search failed, falling back to keyword ranking:', semanticError.message);
          bumpCounter('semanticFailures');
        }
      }

      // --- Fallback: keyword-based ranking ---
      // rankJobs() needs the full Profile row (title/headline/summary/
      // experience/etc., not just the cached embedding + skills). Fetch
      // it lazily here — this path is rare (only hit when semantic
      // returned 0 or failed), so we accept the extra round-trip in
      // exchange for keeping the hot semantic path cache-only.
      const profileForKeyword = await Profile.findOne({
        where: { userId: req.user.id },
        attributes: ['id', 'userId', 'title', 'headline', 'location', 'skills', 'experience', 'summary']
      });
      const POOL_SIZE = 200;
      const allJobs = await ExternalJob.findAll({
        where,
        replacements: whereReplacements,
        // COALESCE so Greenhouse jobs (postedAt = NULL) sort by when we
        // first saw them, intermixed with other-source jobs by their real
        // postedAt — produces a true chronological order across sources.
        order: [literal('"ExternalJob"."effectivePostedAt" DESC NULLS LAST')],
        limit: POOL_SIZE,
        attributes: {
          exclude: ['descriptionHtml', 'metadata', 'embedding']
        },
        include: [{ model: Company, as: 'companyInfo', attributes: ['id', 'name', 'slug', 'domain', 'logoUrl', 'website', 'industry', 'employeeCount', 'employeeRange', 'fundingStage', 'headquarters', 'linkedinUrl'] }]
      });

      const ranked = rankJobs(allJobs, profileForKeyword, { sortMode });
      const total = ranked.length;
      const offset = (pageNum - 1) * limitNum;
      const paginatedJobs = ranked.slice(offset, offset + limitNum);
      bumpCounter('keywordFallbacks');

      // NOTE: the request path no longer triggers crawling.
      //
      // Every listing response used to fan out refreshIfStale() per board in
      // the result set plus a corpus-freshness probe. Each of those does a DB
      // lookup before deciding to no-op, so user traffic was doing crawl
      // bookkeeping on the same undersized Postgres that was serving the
      // query — the documented cause of statement timeouts and
      // crash-into-recovery, and why the corpus self-heal already had to be
      // shipped behind a default-off kill switch.
      //
      // Freshness is owned by the 15-minute sync (ENABLE_EXTERNAL_JOBS_CRON /
      // RUN_CRON_INLINE, see render.yaml), which is where crawling belongs.

      return res.json({
        jobs: paginatedJobs,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum)
        },
        sortMethod: 'keyword'
      });
      } // end: profileCached
    }

    // --- Default: most recent ---
    const offset = (pageNum - 1) * limitNum;

    // Pure chronological order. The search predicate above already
    // restricts to jobs whose title/company/dept match the query (not
    // description-only hits), so sorting by pure recency here gives the
    // user what the "Most recent first" UI label promises: the freshest
    // relevant job on top. COALESCE so Greenhouse jobs (postedAt=NULL)
    // sort by when we first saw them, mixed with other sources by real
    // postedAt. Without this, all Greenhouse jobs would be banished to
    // the bottom.
    // findAndCountAll issues BOTH a COUNT over every matching row and the page
    // SELECT. The COUNT is the expensive half — measured in production, a
    // location-filtered request spent 2,168ms in this stage while a text search
    // (which narrows the set, making the count cheap) spent 265ms; locally the
    // same COUNT costs 5x the page fetch beside it. It also does not vary by
    // page or by user, so it is cached separately and the two run concurrently,
    // making a miss cost max(count, page) rather than their sum. Invalidated
    // with the rest of the external_jobs: namespace on every sync.
    const countKey = buildJobsCountCacheKey(req.query);
    const cachedCount = cache.get(countKey);
    const countWasCached = cachedCount !== undefined && cachedCount !== null;

    const [jobs, count] = await Promise.all([
      ExternalJob.findAll({
        where,
        replacements: whereReplacements,
        order: [literal('"ExternalJob"."effectivePostedAt" DESC NULLS LAST')],
        limit: limitNum,
        offset,
        attributes: {
          exclude: ['descriptionHtml', 'metadata', 'embedding']
        },
        include: [{ model: Company, as: 'companyInfo', attributes: ['id', 'name', 'slug', 'domain', 'logoUrl', 'website', 'industry', 'employeeCount', 'employeeRange', 'fundingStage', 'headquarters', 'linkedinUrl'] }]
      }),
      countWasCached
        ? Promise.resolve(cachedCount)
        : ExternalJob.count({ where, replacements: whereReplacements }),
    ]);
    if (!countWasCached) cache.set(countKey, count, 60 * 1000);
    stamp(countWasCached ? 'listQueryCountCached' : 'listQuery');

      // NOTE: the request path no longer triggers crawling.
      //
      // Every listing response used to fan out refreshIfStale() per board in
      // the result set plus a corpus-freshness probe. Each of those does a DB
      // lookup before deciding to no-op, so user traffic was doing crawl
      // bookkeeping on the same undersized Postgres that was serving the
      // query — the documented cause of statement timeouts and
      // crash-into-recovery, and why the corpus self-heal already had to be
      // shipped behind a default-off kill switch.
      //
      // Freshness is owned by the 15-minute sync (ENABLE_EXTERNAL_JOBS_CRON /
      // RUN_CRON_INLINE, see render.yaml), which is where crawling belongs.

    res.json({
      jobs,
      pagination: {
        total: count,
        page: pageNum,
        pages: Math.ceil(count / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching external jobs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/external-jobs/stats
 * @desc    Get external jobs statistics
 * @access  Public
 */
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    const totalJobs = await ExternalJob.count({ where: { isActive: true } });

    const bySource = await ExternalJob.findAll({
      where: { isActive: true },
      attributes: [
        'source',
        [ExternalJob.sequelize.fn('COUNT', ExternalJob.sequelize.col('id')), 'count']
      ],
      group: ['source'],
      raw: true
    });

    const byLocationType = await ExternalJob.findAll({
      where: { isActive: true },
      attributes: [
        'locationType',
        [ExternalJob.sequelize.fn('COUNT', ExternalJob.sequelize.col('id')), 'count']
      ],
      group: ['locationType'],
      raw: true
    });

    const totalCompanies = await ExternalJob.count({
      where: { isActive: true },
      distinct: true,
      col: 'company'
    });

    const activeBoards = await ATSBoard.count({ where: { isActive: true } });

    res.json({
      totalJobs,
      totalCompanies,
      activeBoards,
      bySource,
      byLocationType
    });
  } catch (error) {
    console.error('Error fetching external job stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/external-jobs/companies
 * @desc    Get list of companies with job counts
 * @access  Public
 *
 * Cached in-memory for 10 minutes — the underlying aggregation only changes
 * when the cron sync runs, and several thousand DB rows shouldn't be
 * counted on every page load.
 */
router.get('/companies', optionalAuth, async (req, res) => {
  try {
    const cacheKey = 'external_jobs:companies';
    let companies = cache.get(cacheKey);
    if (!companies) {
      companies = await ExternalJob.findAll({
        where: { isActive: true },
        attributes: [
          'company',
          'source',
          'boardToken',
          [ExternalJob.sequelize.fn('COUNT', ExternalJob.sequelize.col('id')), 'jobCount']
        ],
        group: ['company', 'source', 'boardToken'],
        order: [[ExternalJob.sequelize.fn('COUNT', ExternalJob.sequelize.col('id')), 'DESC']],
        raw: true
      });
      cache.set(cacheKey, companies, 10 * 60 * 1000);
    }

    res.json({ companies });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/external-jobs/departments
 * @desc    Get list of unique departments with job counts
 * @access  Public
 */
router.get('/departments', optionalAuth, async (req, res) => {
  try {
    const cacheKey = 'external_jobs:departments';
    let departments = cache.get(cacheKey);
    if (!departments) {
      departments = await ExternalJob.findAll({
        where: {
          isActive: true,
          department: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
        },
        attributes: [
          'department',
          [ExternalJob.sequelize.fn('COUNT', ExternalJob.sequelize.col('id')), 'jobCount']
        ],
        group: ['department'],
        order: [[ExternalJob.sequelize.fn('COUNT', ExternalJob.sequelize.col('id')), 'DESC']],
        raw: true
      });
      cache.set(cacheKey, departments, 10 * 60 * 1000);
    }

    res.json({ departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/external-jobs/locations
 * @desc    Get list of unique locations (cities) with job counts
 * @access  Public
 */
router.get('/locations', optionalAuth, async (req, res) => {
  try {
    const cacheKey = 'external_jobs:locations';
    let locations = cache.get(cacheKey);
    if (!locations) {
      // Pull the raw distinct locations + counts (the long tail is wide, so take
      // a generous slice before collapsing). Then fold every spelling of the
      // same place into one canonical metro so the dropdown shows a handful of
      // meaningful options instead of hundreds of near-duplicate "San Francisco"
      // rows. The filter side already expands a selected metro back to its whole
      // commute area via expandLocationAliases, so this is purely presentational.
      const rawLocations = await ExternalJob.findAll({
        where: {
          isActive: true,
          location: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
        },
        attributes: [
          'location',
          [ExternalJob.sequelize.fn('COUNT', ExternalJob.sequelize.col('id')), 'jobCount']
        ],
        group: ['location'],
        order: [[ExternalJob.sequelize.fn('COUNT', ExternalJob.sequelize.col('id')), 'DESC']],
        limit: 2000,
        raw: true
      });

      const buckets = new Map();
      for (const row of rawLocations) {
        const canonical = canonicalizeLocation(row.location);
        if (!canonical) continue;
        const count = parseInt(row.jobCount, 10) || 0;
        buckets.set(canonical, (buckets.get(canonical) || 0) + count);
      }

      locations = Array.from(buckets.entries())
        .map(([location, jobCount]) => ({ location, jobCount }))
        .sort((a, b) => b.jobCount - a.jobCount)
        .slice(0, 200);

      cache.set(cacheKey, locations, 10 * 60 * 1000);
    }

    res.json({ locations });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/external-jobs/skills
 * @desc    Top skills across the active corpus, with counts. Powers the
 *          typeahead in the candidate jobs page skill filter.
 *          Optional ?q= filter for typeahead substring match.
 *          Optional ?limit= (default 100, max 300).
 * @access  Public
 *
 * NOTE: This route MUST be declared BEFORE the /:id route.
 */
router.get('/skills', optionalAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim().toLowerCase();
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 300);

    // Cache the full aggregation (~tens of KB) for 10 minutes. The typeahead
    // query (q=...) and limit are applied AFTER cache lookup so different
    // users hitting different prefixes share the same underlying data.
    const cacheKey = 'external_jobs:top_skills';
    let allSkills = cache.get(cacheKey);
    if (!allSkills) {
      // jsonb_array_elements_text expands the JSON skills array per row into
      // one row per skill, then we group + count. Filters out NULL / empty.
      const rows = await ExternalJob.sequelize.query(
        `SELECT lower(skill) AS skill, COUNT(*)::int AS "jobCount"
           FROM "ExternalJobs",
                LATERAL jsonb_array_elements_text(
                  CASE WHEN jsonb_typeof("skills") = 'array' THEN "skills" ELSE '[]'::jsonb END
                ) AS skill
          WHERE "isActive" = true
            AND skill IS NOT NULL
            AND length(trim(skill)) BETWEEN 2 AND 60
          GROUP BY lower(skill)
          ORDER BY COUNT(*) DESC, lower(skill) ASC
          LIMIT 500`,
        { type: ExternalJob.sequelize.constructor.QueryTypes.SELECT }
      );
      allSkills = rows;
      cache.set(cacheKey, allSkills, 10 * 60 * 1000);
    }

    let filtered = allSkills;
    if (q) {
      filtered = allSkills.filter(s => s.skill.includes(q));
    }

    res.json({ skills: filtered.slice(0, limit) });
  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/external-jobs/health
 * @desc    Corpus-health snapshot for ops debugging:
 *            - Total active jobs
 *            - Active jobs per source
 *            - Per-board: last sync time, error message, age in minutes
 *            - In-process counters (request volume, semantic vs keyword,
 *              cache hit rate)
 *            - Cache stats
 *          Cheap to compute (no joins, all aggregations on indexed columns).
 *          Useful before deploying / when investigating "no jobs" reports.
 * @access  Private (admin only)
 *
 * NOTE: This route MUST be declared BEFORE the /:id route.
 */
router.get('/health', authMiddleware, requireVerifiedEmail, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const totalActive = await ExternalJob.count({ where: { isActive: true } });

    const bySource = await ExternalJob.findAll({
      where: { isActive: true },
      attributes: [
        'source',
        [ExternalJob.sequelize.fn('COUNT', ExternalJob.sequelize.col('id')), 'count']
      ],
      group: ['source'],
      raw: true
    });

    // Freshness snapshot — the single most useful signal when investigating
    // "the list isn't updating" / "24h filter is empty" reports. If
    // `newestJobAgeMinutes` is large (e.g. thousands) and `postedLast24h` is
    // 0, the corpus is stale and the cron sync is the culprit — NOT the
    // filters or the ranking. Uses COALESCE(postedAt, createdAt) to mirror
    // exactly what the list query and the datePosted filter sort/filter on.
    const freshnessRow = await ExternalJob.sequelize.query(
      `SELECT
         MAX("effectivePostedAt") AS newest,
         COUNT(*) FILTER (WHERE "effectivePostedAt" >= NOW() - INTERVAL '24 hours') AS last24h,
         COUNT(*) FILTER (WHERE "effectivePostedAt" >= NOW() - INTERVAL '7 days')  AS last7d
       FROM "ExternalJobs"
       WHERE "isActive" = true`,
      { type: ExternalJob.sequelize.constructor.QueryTypes.SELECT }
    );
    const newest = freshnessRow[0]?.newest ? new Date(freshnessRow[0].newest) : null;
    const freshness = {
      newestJob: newest ? newest.toISOString() : null,
      newestJobAgeMinutes: newest ? Math.round((Date.now() - newest.getTime()) / 60000) : null,
      postedLast24h: parseInt(freshnessRow[0]?.last24h, 10) || 0,
      postedLast7d: parseInt(freshnessRow[0]?.last7d, 10) || 0,
    };

    const boards = await ATSBoard.findAll({
      attributes: ['id', 'name', 'platform', 'boardToken', 'isActive', 'jobCount', 'lastSyncAt', 'syncError'],
      order: [['platform', 'ASC'], ['name', 'ASC']],
      raw: true
    });
    const now = Date.now();
    const boardsWithAge = boards.map(b => ({
      ...b,
      ageMinutes: b.lastSyncAt ? Math.round((now - new Date(b.lastSyncAt).getTime()) / 60000) : null,
      hasError: !!b.syncError,
    }));

    // Counters (in-process — reset on backend restart). Cache hit rate
    // computed inline for convenience.
    const counters = getCountersSnapshot();
    const hitRate = counters.listRequests > 0
      ? +(counters.listCacheHits / counters.listRequests * 100).toFixed(1)
      : 0;
    const semanticTotal = counters.semanticSuccesses + counters.semanticFailures;
    const semanticSuccessRate = semanticTotal > 0
      ? +(counters.semanticSuccesses / semanticTotal * 100).toFixed(1)
      : null;

    // How much of the corpus still has no skills extracted. This is the signal
    // that tells you whether the ?skills= filter and the skill typeahead are
    // actually usable — they read a column that was ~90% empty, which looked
    // like "no jobs match" rather than "we never extracted this".
    let skillExtraction = null;
    try {
      const { countPendingSkillExtraction } = require('../services/jobSkillExtractor');
      const pending = await countPendingSkillExtraction();
      skillExtraction = {
        pending,
        coveragePct: totalActive > 0
          ? +(((totalActive - pending) / totalActive) * 100).toFixed(1)
          : null,
      };
    } catch (e) {
      skillExtraction = { error: e.message };
    }

    let ghost = null;
    try {
      const gd = require('../services/ghostJobDetector');
      ghost = { ...(await gd.getGhostStats()), lastRun: gd.getLastRun() };
    } catch (e) { ghost = { error: e.message }; }

    res.json({
      generatedAt: new Date().toISOString(),
      corpus: {
        totalActive,
        ghost,
        bySource: bySource.map(r => ({ source: r.source, count: parseInt(r.count, 10) })),
        freshness,
        skillExtraction,
      },
      boards: {
        total: boards.length,
        active: boards.filter(b => b.isActive).length,
        withErrors: boardsWithAge.filter(b => b.hasError).length,
        list: boardsWithAge,
      },
      counters: {
        ...counters,
        listCacheHitRatePct: hitRate,
        semanticSuccessRatePct: semanticSuccessRate,
      },
      cache: cache.stats(),
    });
  } catch (error) {
    console.error('Error fetching external-jobs health:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/external-jobs/admin/resync
 * @desc    One-shot, on-demand re-sync of active boards on a platform that
 *          still have NULL-postedAt jobs, to capture & backfill their real
 *          posting dates (e.g. heal the historical Ashby postedAt gap). Runs
 *          in the BACKGROUND and returns immediately; poll /admin/resync-status
 *          to watch progress. Single-flight — a second call while one is
 *          running is a no-op. Gentle: sequential, concurrency 1, scoped only
 *          to boards that need it.
 *          Body: { platform = 'ashby', maxBoards = null }
 * @access  Private (admin only)
 *
 * NOTE: This route MUST be declared BEFORE the /:id route.
 */
router.post('/admin/resync', authMiddleware, requireVerifiedEmail, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    const platform = (req.body && req.body.platform ? String(req.body.platform) : 'ashby').toLowerCase();
    const maxBoards = req.body && req.body.maxBoards != null ? parseInt(req.body.maxBoards, 10) : null;
    const result = await startDateResync({ platform, maxBoards: Number.isInteger(maxBoards) ? maxBoards : null });
    return res.status(result.started ? 202 : 409).json(result);
  } catch (error) {
    console.error('Error starting date resync:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/external-jobs/admin/resync-status
 * @desc    Live progress of the most recent /admin/resync run.
 * @access  Private (admin only)
 *
 * NOTE: This route MUST be declared BEFORE the /:id route.
 */
router.get('/admin/resync-status', authMiddleware, requireVerifiedEmail, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    return res.json(getDateResyncStatus());
  } catch (error) {
    console.error('Error fetching date resync status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/external-jobs/admin/discover-boards
 * @desc    Kick off a background discovery sweep (Getro VC-portfolio networks +
 *          YC directory) to GROW board coverage on demand instead of waiting for
 *          the weekly cron. Idempotent; single-flight. 202 on start, 409 if one
 *          is already running. Body: { getroStart=1, getroEnd=1500 }.
 * @access  Private (admin only)
 *
 * NOTE: This route MUST be declared BEFORE the /:id route.
 */
router.post('/admin/discover-boards', authMiddleware, requireVerifiedEmail, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    const getroStart = req.body && req.body.getroStart != null ? parseInt(req.body.getroStart, 10) : 1;
    const getroEnd = req.body && req.body.getroEnd != null ? parseInt(req.body.getroEnd, 10) : 1500;
    const result = startBoardDiscovery({
      getroStart: Number.isInteger(getroStart) ? getroStart : 1,
      getroEnd: Number.isInteger(getroEnd) ? getroEnd : 1500,
    });
    return res.status(result.started ? 202 : 409).json(result);
  } catch (error) {
    console.error('Error starting board discovery:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/external-jobs/admin/discover-status
 * @desc    Live progress of the most recent /admin/discover-boards run.
 * @access  Private (admin only)
 *
 * NOTE: This route MUST be declared BEFORE the /:id route.
 */
router.get('/admin/discover-status', authMiddleware, requireVerifiedEmail, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    return res.json(getBoardDiscoveryStatus());
  } catch (error) {
    console.error('Error fetching discovery status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/external-jobs/recommended
 * @desc    "Recommended for you" rail — top N relevant + recent jobs with
 *          a per-job reason string. Powers the strip at the top of the
 *          Discover tab. Always pulls from the last 14 days so the rail
 *          is genuinely fresh; falls back to 30 days if too few results.
 * @access  Private (Candidate)
 *
 * NOTE: This route MUST be declared BEFORE the /:id route.
 */
router.get('/recommended', authMiddleware, requireVerifiedEmail, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);

    const profile = await Profile.findOne({
      where: { userId: req.user.id },
      attributes: ['id', 'userId', 'title', 'headline', 'location', 'skills', 'experience', 'summary', 'openaiEmbedding', 'openaiEmbeddingUpdatedAt']
    });
    if (!profile) {
      return res.json({ jobs: [], reason: 'no_profile' });
    }

    // Resolve profile embedding (persisted preferred; lazy-regen as fallback).
    // Treat embeddings older than EMBEDDING_TTL_MS as stale and regenerate so
    // skill/title edits that bypassed the afterSave hook still get reflected.
    const EMBEDDING_TTL_MS = 24 * 60 * 60 * 1000;
    const embeddingAgeMs = profile.openaiEmbeddingUpdatedAt
      ? Date.now() - new Date(profile.openaiEmbeddingUpdatedAt).getTime()
      : Infinity;
    const embeddingIsStale = embeddingAgeMs > EMBEDDING_TTL_MS;

    let profileEmbedding = null;
    if (profile.openaiEmbedding && !embeddingIsStale) {
      profileEmbedding = Array.isArray(profile.openaiEmbedding)
        ? profile.openaiEmbedding
        : (typeof profile.openaiEmbedding === 'string' ? JSON.parse(profile.openaiEmbedding) : null);
    }
    if (!profileEmbedding) {
      try {
        const { regenerateProfileOpenAIEmbedding } = require('../services/jobEmbeddingService');
        profileEmbedding = await regenerateProfileOpenAIEmbedding(profile);
      } catch (e) {
        console.warn('[Recommended] embedding generation failed:', e.message);
      }
    }

    // Try a tight 14-day window first; widen to 30 days if too few results.
    const tryWindow = async (days) => {
      if (profileEmbedding) {
        try {
          const result = await searchSimilarJobs(profileEmbedding, {
            limit,
            offset: 0,
            datePosted: days <= 7 ? 'week' : (days <= 14 ? '2weeks' : 'month'),
          });
          const semanticRows = result.rows || [];
          // Empty result here almost always means the ExternalJob corpus
          // has no embeddings yet (the searchSimilarJobs WHERE requires
          // embedding IS NOT NULL). Fall through to the keyword path so
          // the rail still has content while backfill runs.
          if (semanticRows.length > 0) return semanticRows;
          console.warn('[Recommended] semantic search returned 0 rows — falling back to keyword ranking. Likely cause: jobs missing embeddings (run scripts/backfillJobEmbeddings.js).');
        } catch (e) {
          console.warn('[Recommended] semantic search failed, falling back:', e.message);
        }
      }
      // Keyword fallback — pulls a recent pool and ranks JS-side.
      const sinceDays = days;
      const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
      const pool = await ExternalJob.findAll({
        where: {
          isActive: true,
          [Op.and]: [
            literal(`"ExternalJob"."effectivePostedAt" >= '${since.toISOString()}'`),
          ]
        },
        // COALESCE so Greenhouse jobs (postedAt = NULL) sort by when we
        // first saw them, intermixed with other-source jobs by their real
        // postedAt — produces a true chronological order across sources.
        order: [literal('"ExternalJob"."effectivePostedAt" DESC NULLS LAST')],
        limit: 200,
        attributes: { exclude: ['descriptionHtml', 'metadata', 'embedding'] },
        include: [{ model: Company, as: 'companyInfo', attributes: ['id', 'name', 'slug', 'domain', 'logoUrl', 'website', 'industry', 'employeeCount', 'employeeRange', 'fundingStage', 'headquarters', 'linkedinUrl'] }]
      });
      return rankJobs(pool, profile).slice(0, limit);
    };

    let jobs = await tryWindow(14);
    if (jobs.length < Math.min(limit, 4)) jobs = await tryWindow(30);

    // Build a short reason string per job — uses signals already on the
    // payload (relevanceScore, matched skills inferred from job.skills ∩
    // profile skills, postedAt). Cheap and explainable; no extra LLM call.
    const profileSkills = extractSkillSetFromProfile(profile);
    const enriched = jobs.map(j => ({
      ...(j.toJSON ? j.toJSON() : j),
      _recommendationReason: buildReason(j, profileSkills),
    }));

    res.json({
      jobs: enriched,
      windowDays: enriched.length > 0 ? (enriched[0]._windowDays || 14) : null,
    });
  } catch (error) {
    console.error('Error building recommended jobs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Pull the candidate's skills into a flat lowercased Set for matching.
 * Handles both the structured shape ({frontend: [...], backend: [...]})
 * and the legacy array shape.
 */
function extractSkillSetFromProfile(profile) {
  const out = new Set();
  const raw = profile.skills;
  if (!raw) return out;
  if (Array.isArray(raw)) {
    for (const s of raw) {
      const v = (typeof s === 'string' ? s : (s?.name || '')).toLowerCase().trim();
      if (v) out.add(v);
    }
  } else if (typeof raw === 'object') {
    for (const arr of Object.values(raw)) {
      if (!Array.isArray(arr)) continue;
      for (const s of arr) {
        const v = (typeof s === 'string' ? s : (s?.name || '')).toLowerCase().trim();
        if (v) out.add(v);
      }
    }
  }
  return out;
}

/**
 * Compose a one-line reason badge for a recommended job. Format examples:
 *   "Matches your React, TypeScript, AWS skills • posted 2d ago"
 *   "Strong fit for Senior Engineer roles • new today"
 *   "Recent listing for your area"
 */
function buildReason(job, profileSkills) {
  const parts = [];

  // Skill overlap
  if (profileSkills.size > 0 && Array.isArray(job.skills) && job.skills.length > 0) {
    const overlap = job.skills
      .map(s => String(s).toLowerCase().trim())
      .filter(s => profileSkills.has(s));
    if (overlap.length >= 1) {
      const top = overlap.slice(0, 3).map(toTitleCase);
      const more = overlap.length > 3 ? ` +${overlap.length - 3} more` : '';
      parts.push(`Matches your ${top.join(', ')}${more}`);
    }
  }

  // Match strength — always surface a % when we have one, so candidates
  // don't see the vague "Recent listing for your area" hiding a 25% fit.
  if (typeof job.relevanceScore === 'number') {
    const pct = Math.round(job.relevanceScore);
    if (parts.length === 0) {
      if (pct >= 70) parts.push(`Strong fit (${pct}% match)`);
      else if (pct >= 40) parts.push(`${pct}% match`);
      else if (pct > 0) parts.push(`${pct}% match — light overlap`);
    }
  }

  // Recency
  const anchor = job.effectivePostedAt || job.postedAt || job.createdAt;
  if (anchor) {
    const days = Math.floor((Date.now() - new Date(anchor).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) parts.push('new today');
    else if (days === 1) parts.push('posted 1d ago');
    else if (days <= 14) parts.push(`posted ${days}d ago`);
  }

  if (parts.length === 0) parts.push('Recent listing for your area');
  return parts.join(' • ');
}

function toTitleCase(s) {
  return String(s).split(/\s+/).map(w => w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)).join(' ');
}

/**
 * @route   GET /api/external-jobs/saved
 * @desc    Get the current user's saved external jobs
 * @access  Private (Candidate)
 *
 * NOTE: This route MUST be declared BEFORE the /:id route, otherwise
 * Express would match "saved" as the :id parameter.
 */
router.get('/saved', authMiddleware, requireVerifiedEmail, async (req, res) => {
  try {
    const saves = await SavedJob.findAll({
      where: { userId: req.user.id, externalJobId: { [Op.ne]: null } },
      include: [{
        model: ExternalJob,
        as: 'externalJob',
        include: [{ model: Company, as: 'companyInfo', attributes: ['id', 'name', 'slug', 'domain', 'logoUrl', 'website', 'industry', 'employeeCount', 'employeeRange', 'fundingStage', 'headquarters', 'linkedinUrl'] }]
      }],
      order: [['createdAt', 'DESC']]
    });

    // Filter out any rows whose external job has been deleted (FK CASCADE
    // should prevent this, but defend against transient race conditions).
    const jobs = saves
      .filter(s => s.externalJob)
      .map(s => ({ ...s.externalJob.toJSON(), savedAt: s.createdAt }));

    res.json({ savedJobs: jobs });
  } catch (error) {
    console.error('Error fetching saved external jobs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/external-jobs/check-saved
 * @desc    Given a list of external job IDs, return which ones are saved
 *          by the current user. Mirrors the platform /jobs/check-saved API.
 * @access  Private (Candidate)
 */
router.post('/check-saved', authMiddleware, requireVerifiedEmail, async (req, res) => {
  try {
    const { externalJobIds } = req.body;
    if (!externalJobIds || !Array.isArray(externalJobIds)) {
      return res.status(400).json({ message: 'externalJobIds array is required' });
    }
    if (externalJobIds.length === 0) {
      return res.json({ savedExternalJobIds: [] });
    }

    const saves = await SavedJob.findAll({
      where: {
        userId: req.user.id,
        externalJobId: { [Op.in]: externalJobIds }
      },
      attributes: ['externalJobId']
    });

    res.json({ savedExternalJobIds: saves.map(s => s.externalJobId) });
  } catch (error) {
    console.error('Error checking saved external jobs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Job-URL normalization moved to utils/jobUrl.js. It must stay identical to the
// version used when PERSISTING ExternalApplications.normalizedJobUrl — a second
// copy that drifted would stop stored keys matching lookup keys and let
// duplicates reappear silently. Imported at the top of this file.

/**
 * @route   POST /api/external-jobs/check-applied
 * @desc    Given a list of external job IDs, return which ones the current
 *          user has already applied to. Two sources are consulted:
 *            1. ApplyPilotApplication — agent applications keyed directly
 *               by externalJobId (only rows that actually reached the ATS:
 *               status submitting/submitted).
 *            2. ExternalApplication — Chrome-extension-tracked applications,
 *               matched by normalized jobUrl against the job's
 *               applyUrl/sourceUrl.
 *          Mirrors the shape of /check-saved above.
 * @access  Private (Candidate)
 */
router.post('/check-applied', authMiddleware, requireVerifiedEmail, async (req, res) => {
  try {
    const { externalJobIds } = req.body;
    if (!externalJobIds || !Array.isArray(externalJobIds)) {
      return res.status(400).json({ message: 'externalJobIds array is required' });
    }
    // Cap to one page worth of ids — the client sends the visible list.
    const ids = externalJobIds.slice(0, 200);
    if (ids.length === 0) {
      return res.json({ appliedExternalJobIds: [], startedExternalJobIds: [] });
    }

    const applied = new Set();
    const started = new Set();

    // 1. ApplyPilot agent applications (direct externalJobId link). These are
    //    the one signal that has always been trustworthy: the statuses below
    //    mean the agent actually reached the ATS.
    const pilotApps = await ApplyPilotApplication.findAll({
      where: {
        userId: req.user.id,
        externalJobId: { [Op.in]: ids },
        status: { [Op.in]: ['submitting', 'submitted'] },
      },
      attributes: ['externalJobId'],
    });
    for (const a of pilotApps) applied.add(a.externalJobId);

    // 2. Tracked applications linked directly by externalJobId. Split by stage:
    //    only a CONFIRMED application earns the "Applied" badge. A row that is
    //    merely 'clicked' (the user opened the ATS) or 'in_progress' (they
    //    started the form) is reported separately so the UI can show a softer
    //    "started" affordance instead of claiming they applied.
    const { classifyJobIdsForUser } = require('../services/applicationTrackingService');
    const classified = await classifyJobIdsForUser(req.user.id, ids);
    for (const id of classified.applied) applied.add(id);
    for (const id of classified.started) started.add(id);

    // 3. Extension/manual applications with no FK — matched by URL.
    //     Skip ids already resolved above by either bucket; a row we've already
    //     classified as merely 'clicked' must not be re-added as applied here.
    const remaining = ids.filter(id => !applied.has(id) && !started.has(id));
    if (remaining.length > 0) {
      const jobs = await ExternalJob.findAll({
        where: { id: { [Op.in]: remaining } },
        attributes: ['id', 'applyUrl', 'sourceUrl'],
      });

      // normalized URL → external job ids that share it
      const urlToJobIds = new Map();
      for (const j of jobs) {
        for (const u of [j.applyUrl, j.sourceUrl]) {
          const key = normalizeJobUrl(u);
          if (!key) continue;
          if (!urlToJobIds.has(key)) urlToJobIds.set(key, []);
          urlToJobIds.get(key).push(j.id);
        }
      }

      if (urlToJobIds.size > 0) {
        // ExternalApplication.jobUrl is free-form (scraped by the extension),
        // so exact SQL matching would miss tracking-param variants. Pull just
        // the user's application URLs and normalize in JS — one indexed query
        // on userId, and users have at most a few thousand rows.
        const extApps = await ExternalApplication.findAll({
          where: { userId: req.user.id },
          attributes: ['jobUrl', 'normalizedJobUrl', 'status'],
        });
        const { isConfirmedApplication } = require('../services/applicationTrackingService');
        for (const a of extApps) {
          // Prefer the stored normalized key; fall back to normalizing the raw
          // URL for rows written before that column existed.
          const key = a.normalizedJobUrl || normalizeJobUrl(a.jobUrl);
          const hit = key && urlToJobIds.get(key);
          if (!hit) continue;
          // Same stage rule as above — a URL match proves WHICH job the row is
          // about, not that the user finished applying to it.
          const bucket = isConfirmedApplication(a.status)
            ? applied
            : (a.status === 'withdrawn' ? null : started);
          if (bucket) for (const id of hit) bucket.add(id);
        }
      }
    }

    res.json({
      appliedExternalJobIds: [...applied],
      // Jobs the user opened or began but has not confirmed applying to. The
      // list page renders these differently from "Applied" and can prompt for
      // confirmation instead of silently assuming.
      startedExternalJobIds: [...started].filter(id => !applied.has(id)),
    });
  } catch (error) {
    console.error('Error checking applied external jobs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/external-jobs/:id/applied
 * @desc    Record that the current user applied to an external job — fired when
 *          they tap "Apply Now" on an in-app job card (the actual application
 *          happens off-site on the company ATS, which we can't observe, so this
 *          records intent as status='clicked' — NOT as an application. See
 *          services/applicationTrackingService.js for the stage ladder.
 *          Idempotent: creates or advances one ExternalApplication per
 *          (user, job). Denormalizes the job's title/company/location/url so the
 *          Applications view renders without a join. Never resurrects a
 *          withdrawn row.
 * @access  Private (Candidate)
 */
router.post('/:id/applied', authMiddleware, requireVerifiedEmail, async (req, res) => {
  try {
    const job = await ExternalJob.findByPk(req.params.id, {
      attributes: ['id', 'title', 'company', 'location', 'locationType',
        'employmentType', 'source', 'applyUrl', 'sourceUrl'],
    });
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // A click records INTENT, not an application. All we actually observe is
    // that the user opened the company's ATS in a new tab — whether they filled
    // anything in, let alone submitted, happens off-site where we cannot see
    // it. Recording this as 'applied' (the old behaviour) inflated every
    // applied count and badged jobs the user never applied to.
    //
    // The row is promoted to 'applied' later by a signal that actually proves
    // submission: the extension detecting a form submit / confirmation page,
    // ApplyPilot reaching the ATS, or the user confirming. Promotion is
    // monotonic, so a second visit to a job already applied to cannot demote it
    // back to 'clicked'.
    const { recordApplicationSignal } = require('../services/applicationTrackingService');
    const { application, created } = await recordApplicationSignal({
      userId: req.user.id,
      externalJobId: job.id,
      jobUrl: job.applyUrl || job.sourceUrl || null,
      stage: 'clicked',
      confirmedBy: 'click',
      fields: {
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        locationType: job.locationType,
        jobType: job.employmentType,
        platform: job.source,
      },
    });

    res.status(created ? 201 : 200).json({ application, created });
  } catch (error) {
    console.error('Error recording external application:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/external-jobs/:id/confirm-applied
 * @desc    The user tells us they finished applying. This is the ONLY signal
 *          available for candidates without the Chrome extension: the actual
 *          submission happens on the company's ATS, which we cannot observe,
 *          so without asking we would either over-count every click as an
 *          application or never record one at all.
 *
 *          Promotes the row to 'applied' with confirmedBy='user'. Creates the
 *          row if the user confirms a job they never clicked through in-app.
 *          Promotion is monotonic, so confirming something already further
 *          along the pipeline (screening, offer) leaves it where it is.
 * @access  Private (Candidate)
 */
router.post('/:id/confirm-applied', authMiddleware, requireVerifiedEmail, async (req, res) => {
  try {
    const job = await ExternalJob.findByPk(req.params.id, {
      attributes: ['id', 'title', 'company', 'location', 'locationType',
        'employmentType', 'source', 'applyUrl', 'sourceUrl'],
    });
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const { recordApplicationSignal } = require('../services/applicationTrackingService');
    const { application, promoted } = await recordApplicationSignal({
      userId: req.user.id,
      externalJobId: job.id,
      jobUrl: job.applyUrl || job.sourceUrl || null,
      stage: 'applied',
      confirmedBy: 'user',
      fields: {
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        locationType: job.locationType,
        jobType: job.employmentType,
        platform: job.source,
      },
    });

    res.json({ application, promoted });
  } catch (error) {
    console.error('Error confirming external application:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/external-jobs/:id/save
 * @desc    Save an external job for the current user
 * @access  Private (Candidate)
 */
router.post('/:id/save', authMiddleware, requireVerifiedEmail, async (req, res) => {
  try {
    const externalJobId = req.params.id;

    // Make sure the external job exists before recording a save.
    const job = await ExternalJob.findByPk(externalJobId, { attributes: ['id'] });
    if (!job) {
      return res.status(404).json({ message: 'External job not found' });
    }

    // Idempotent: if already saved, just return success.
    const existing = await SavedJob.findOne({
      where: { userId: req.user.id, externalJobId }
    });
    if (existing) {
      return res.json({ message: 'Job already saved', saved: true });
    }

    await SavedJob.create({
      userId: req.user.id,
      externalJobId
    });

    res.json({ message: 'Job saved successfully', saved: true });
  } catch (error) {
    console.error('Error saving external job:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/external-jobs/:id/save
 * @desc    Unsave an external job for the current user
 * @access  Private (Candidate)
 */
router.delete('/:id/save', authMiddleware, async (req, res) => {
  try {
    const externalJobId = req.params.id;

    const deleted = await SavedJob.destroy({
      where: { userId: req.user.id, externalJobId }
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Saved job not found' });
    }

    res.json({ message: 'Job unsaved successfully', saved: false });
  } catch (error) {
    console.error('Error unsaving external job:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/external-jobs/:id
 * @desc    Get a single external job with full details
 * @access  Public
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    // ExternalJobs.id is a UUID. A non-UUID param (e.g. a typo'd path like
    // /external-jobs/search, or a stray sub-route that was never defined)
    // would otherwise reach Postgres as `WHERE id = 'search'` and throw
    // `invalid input syntax for type uuid` → a noisy 500. Treat anything that
    // isn't a UUID as a plain 404.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(String(req.params.id || ''))) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const job = await ExternalJob.findByPk(req.params.id, {
      // `embedding` is a 512-dim pgvector serialized as a long text array.
      // It exists purely for server-side similarity search and no client
      // reads it, so shipping it here was several KB of pure waste on every
      // detail fetch. `metadata` IS still returned — the jobs page reads it.
      attributes: { exclude: ['embedding'] },
      include: [{ model: Company, as: 'companyInfo', attributes: ['id', 'name', 'slug', 'domain', 'logoUrl', 'website', 'industry', 'employeeCount', 'employeeRange', 'fundingStage', 'headquarters', 'linkedinUrl'] }]
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Detail views likewise do not trigger a crawl — see the note on the list
    // handler above. The sync cron owns freshness.

    res.json(job);
  } catch (error) {
    console.error('Error fetching external job:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
