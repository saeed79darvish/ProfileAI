const express = require('express');
const router = express.Router();
const { ExternalJob, ATSBoard, Profile, Company, SavedJob } = require('../models');
const authMiddleware = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const { Op, literal } = require('sequelize');
const { refreshIfStale, ensureCorpusFresh } = require('../services/externalJobService');
const { rankJobs } = require('../services/jobRelevanceService');
const { searchSimilarJobs, generateProfileQueryEmbedding, generateSearchQueryEmbedding, loadProfileForJobsRanking } = require('../services/jobEmbeddingService');
const cache = require('../services/simpleCache');

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
 *   'recommended' (default) — match × recency. Best of both worlds.
 *   'recent'                — pure recency (newest first), match used only as tiebreak.
 *   'match'                 — pure match (highest %), recency used only as tiebreak.
 *
 * Anything else (including missing) falls back to 'recommended'.
 */
function normalizeSortMode(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'recent' || v === 'match' || v === 'recommended') return v;
  // Backwards compat: legacy callers used "relevance" for the default.
  if (v === 'relevance' || v === '') return 'recommended';
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
  const stamp = (label) => stages.push(`${label}=${Date.now() - reqStartedAt}ms`);
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
    res.json = (payload) => {
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
    const search = typeof rawSearch === 'string'
      ? rawSearch
          .replace(/<[^>]*>/g, ' ')            // strip HTML tags
          .replace(/[\u0000-\u001F\u007F]/g, ' ') // strip ASCII control chars
          .replace(/\s+/g, ' ')                // collapse whitespace
          .trim()
          .slice(0, 200)
      : '';

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

    // Startup filter. We don't have a single canonical "is this a startup"
    // flag, so we OR together the strongest signals we have:
    //   - source in startup-leaning boards (HN, Lever, Ashby, WeWorkRemotely,
    //     RemoteOK, TheirStack) — these skew heavily toward startups; the
    //     bulk of enterprise listings come through Greenhouse / Amazon / jsearch.
    //   - companyInfo.employeeCount < 500 (small co), OR
    //   - companyInfo.employeeRange in early-bucket (1-10 / 11-50 / 51-200 / 201-500), OR
    //   - companyInfo.fundingStage in early-stage values.
    // Many rows have companyId = NULL (no enrichment yet), so the source
    // arm carries them. Without it the filter would return ~78 of 13k jobs.
    //
    // We then SUBTRACT a deny-list of known non-startups (Stripe, OpenAI,
    // Twilio, etc.) and any company whose funding stage is late/IPO/acquired.
    // See backend/utils/startupClassifier.js for the curated lists.
    const { NON_STARTUP_COMPANIES, NON_STARTUP_FUNDING_STAGES } = require('../utils/startupClassifier');
    const wantStartup = String(startup || '').toLowerCase() === 'true';
    if (wantStartup) {
      whereReplacements.nonStartupNames = NON_STARTUP_COMPANIES;
      whereReplacements.nonStartupStages = NON_STARTUP_FUNDING_STAGES;
      where[Op.and] = [
        ...(where[Op.and] || []),
        literal(`(
          "ExternalJob"."source" IN ('hn_hiring','lever','ashby','wwr','remoteok','theirstack')
          OR EXISTS (
            SELECT 1 FROM "Companies" c
            WHERE c.id = "ExternalJob"."companyId"
              AND (
                (c."employeeCount" IS NOT NULL AND c."employeeCount" < 500)
                OR c."employeeRange" IN ('1-10','11-50','51-200','201-500')
                OR LOWER(COALESCE(c."fundingStage", '')) IN
                   ('pre-seed','preseed','seed','series-a','series_a','series a','series-b','series_b','series b','series-c','series_c','series c')
              )
          )
        )`),
        literal(`LOWER(COALESCE("ExternalJob"."company", '')) <> ALL(ARRAY[:nonStartupNames]::text[])`),
        literal(`NOT EXISTS (
          SELECT 1 FROM "Companies" c2
          WHERE c2.id = "ExternalJob"."companyId"
            AND LOWER(COALESCE(c2."fundingStage", '')) = ANY(ARRAY[:nonStartupStages]::text[])
        )`)
      ];
    }

    if (search) {
      // Weighted full-text search backed by ExternalJobs.searchTsv (a
      // STORED generated tsvector column with weights A=title, B=company/
      // dept, C=description) plus a GIN index. See
      // scripts/migrations/addExternalJobSearchTsv.js.
      //
      // We require a hit in the title/company/dept (weights A or B), not
      // description (weight C). Description hits are noisy — a Back-End
      // job whose JD body happens to mention "frontend" should NOT match
      // a search for "Frontend Engineer". ts_rank_cd with custom weights
      // {D=0,C=0,B=1,A=1} returns 0 for description-only matches, so the
      // > 0 filter drops them. The plainto_tsquery @@ check stays as the
      // GIN-indexable predicate (fast); the ts_rank_cd is a cheap
      // post-filter on the already-narrowed result set.
      //
      // The query string flows through Sequelize's :tsQuery replacement
      // (escaped server-side) instead of being hand-interpolated, which
      // closes the previous SQL-injection vector here.
      whereReplacements.tsQuery = String(search);
      where[Op.and] = [
        ...(where[Op.and] || []),
        // GIN-indexable predicate: any hit in the tsv (A/B/C). Kept so the
        // index is still used to narrow the candidate set.
        literal(`"ExternalJob"."searchTsv" @@ plainto_tsquery('english', :tsQuery)`),
        // Hard filter: require a hit in the A (title) or B (company /
        // department) weights only. Description-only hits (weight C) are
        // rejected — a Workplace Operations JD that mentions "frontend"
        // in its body must NOT match a "Frontend Engineer" search.
        // We re-build a weight-restricted tsvector inline and check it
        // against the same query. This runs only on the already-narrowed
        // GIN result set, so it stays cheap.
        literal(`(
          setweight(to_tsvector('english', coalesce("ExternalJob"."title", '')), 'A') ||
          setweight(to_tsvector('english', coalesce("ExternalJob"."company", '')), 'B') ||
          setweight(to_tsvector('english', coalesce("ExternalJob"."department", '')), 'B')
        ) @@ plainto_tsquery('english', :tsQuery)`)
      ];
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
          literal(`COALESCE("ExternalJob"."postedAt", "ExternalJob"."createdAt") >= :dateCutoff`)
        ];
      }
    }

    if (location) {
      where.location = { [Op.iLike]: `%${location}%` };
    }

    if (locationType) {
      where.locationType = locationType;
    }

    if (employmentType) {
      where.employmentType = employmentType;
    }

    if (experienceLevel) {
      where.experienceLevel = experienceLevel;
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
        let searchEmbedding = null;
        if (search) {
          try {
            searchEmbedding = await generateSearchQueryEmbedding(search);
          } catch (e) {
            console.warn('[ExternalJobs] Could not generate search embedding:', e.message);
          }
          stamp('searchEmb');
        }

        try {
          const semanticResult = await searchSimilarJobs(profileEmbedding, {
            limit: limitNum,
            offset: (pageNum - 1) * limitNum,
            locationType: locationType || null,
            location: location || null,
            search: search || null,
            searchEmbedding: searchEmbedding || null,
            datePosted: datePosted || null,
            company: company || null,
            experienceLevel: experienceLevel || null,
            employmentType: employmentType || null,
            department: department || null,
            skills: skillTokens.length > 0 ? skillTokens : null,
            startup: wantStartup,
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

          // Trigger background staleness checks — deferred to next tick so
          // res.json() flushes first. Each refreshIfStale() does a DB lookup
          // before deciding to no-op; running them inline steals DB pool
          // slots from sibling /external-jobs requests in flight.
          const boardTokens = [...new Set(semanticJobs.map(j => j.boardToken))];
          setImmediate(() => { boardTokens.forEach(token => refreshIfStale(token)); ensureCorpusFresh(); });

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
        order: [literal('COALESCE("ExternalJob"."postedAt", "ExternalJob"."createdAt") DESC NULLS LAST')],
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

      // Trigger background staleness checks — deferred (see comment above).
      const boardTokens = [...new Set(paginatedJobs.map(j => j.boardToken))];
      setImmediate(() => { boardTokens.forEach(token => refreshIfStale(token)); ensureCorpusFresh(); });

      return res.json({
        jobs: paginatedJobs,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum)
        },
        sortMethod: 'keyword'
      });
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
    const { count, rows: jobs } = await ExternalJob.findAndCountAll({
      where,
      replacements: whereReplacements,
      order: [literal('COALESCE("ExternalJob"."postedAt", "ExternalJob"."createdAt") DESC NULLS LAST')],
      limit: limitNum,
      offset,
      attributes: {
        exclude: ['descriptionHtml', 'metadata', 'embedding']
      },
      include: [{ model: Company, as: 'companyInfo', attributes: ['id', 'name', 'slug', 'domain', 'logoUrl', 'website', 'industry', 'employeeCount', 'employeeRange', 'fundingStage', 'headquarters', 'linkedinUrl'] }]
    });

    // Trigger background staleness checks for boards in results —
    // deferred so the response flushes before DB lookups fan out.
    const boardTokens = [...new Set(jobs.map(j => j.boardToken))];
    setImmediate(() => { boardTokens.forEach(token => refreshIfStale(token)); ensureCorpusFresh(); });

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
      locations = await ExternalJob.findAll({
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
        limit: 500,
        raw: true
      });
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
router.get('/health', authMiddleware, async (req, res) => {
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
         MAX(COALESCE("postedAt", "createdAt")) AS newest,
         COUNT(*) FILTER (WHERE COALESCE("postedAt", "createdAt") >= NOW() - INTERVAL '24 hours') AS last24h,
         COUNT(*) FILTER (WHERE COALESCE("postedAt", "createdAt") >= NOW() - INTERVAL '7 days')  AS last7d
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

    res.json({
      generatedAt: new Date().toISOString(),
      corpus: {
        totalActive,
        bySource: bySource.map(r => ({ source: r.source, count: parseInt(r.count, 10) })),
        freshness,
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
 * @route   GET /api/external-jobs/recommended
 * @desc    "Recommended for you" rail — top N relevant + recent jobs with
 *          a per-job reason string. Powers the strip at the top of the
 *          Discover tab. Always pulls from the last 14 days so the rail
 *          is genuinely fresh; falls back to 30 days if too few results.
 * @access  Private (Candidate)
 *
 * NOTE: This route MUST be declared BEFORE the /:id route.
 */
router.get('/recommended', authMiddleware, async (req, res) => {
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
            literal(`COALESCE("ExternalJob"."postedAt", "ExternalJob"."createdAt") >= '${since.toISOString()}'`),
          ]
        },
        // COALESCE so Greenhouse jobs (postedAt = NULL) sort by when we
        // first saw them, intermixed with other-source jobs by their real
        // postedAt — produces a true chronological order across sources.
        order: [literal('COALESCE("ExternalJob"."postedAt", "ExternalJob"."createdAt") DESC NULLS LAST')],
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
  const anchor = job.postedAt || job.createdAt;
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
router.get('/saved', authMiddleware, async (req, res) => {
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
router.post('/check-saved', authMiddleware, async (req, res) => {
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

/**
 * @route   POST /api/external-jobs/:id/save
 * @desc    Save an external job for the current user
 * @access  Private (Candidate)
 */
router.post('/:id/save', authMiddleware, async (req, res) => {
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
    const job = await ExternalJob.findByPk(req.params.id, {
      include: [{ model: Company, as: 'companyInfo', attributes: ['id', 'name', 'slug', 'domain', 'logoUrl', 'website', 'industry', 'employeeCount', 'employeeRange', 'fundingStage', 'headquarters', 'linkedinUrl'] }]
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Trigger staleness check for this board
    refreshIfStale(job.boardToken);

    res.json(job);
  } catch (error) {
    console.error('Error fetching external job:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
