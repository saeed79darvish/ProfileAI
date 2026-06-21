/**
 * Job Embedding Service
 * 
 * Uses OpenAI text-embedding-3-small (512 dims) to generate embeddings
 * for ExternalJobs. Works with pgvector for cosine similarity search
 * against candidate Profile embeddings.
 * 
 * Cost: ~$0.02 per 1M tokens — embedding 11k jobs ≈ $0.10
 */

const OpenAI = require('openai');
const sequelize = require('../config/database');
const { expandLocationAliases } = require('../utils/locationMatch');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 512;
const MAX_BATCH_SIZE = 100; // OpenAI batch limit for embeddings

// In-memory cache for profile query embeddings (avoids repeated OpenAI calls)
// Key: `profile:<userId>`, Value: { embedding, textHash, expiresAt }
const profileEmbeddingCache = new Map();
const PROFILE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// In-memory cache for raw search-query embeddings. Without this, every
// keystroke in the jobs search box triggers a fresh OpenAI embedding
// call — wasteful in dollars and latency. The query text is the cache
// key (after trim/lower-case normalization), so partial searches like
// "fronten" → "frontend" each get their own entry but a repeat search
// for "frontend" returns instantly. Bounded to 500 entries (FIFO
// eviction) to keep memory predictable.
const searchEmbeddingCache = new Map();
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SEARCH_CACHE_MAX_ENTRIES = 500;

// In-memory cache for the COUNT(*) query in searchSimilarJobs.
//
// The count query runs the full WHERE clause (including `embedding IS NOT
// NULL` which has no supporting index) over the entire ExternalJobs
// corpus — on a 13k+ row table that's the dominant cost of every cache
// miss on /external-jobs, often dwarfing the ANN+rank SELECT itself
// (HNSW + ann_candidates LIMIT 500 caps the latter at ~50ms).
//
// Crucially, the count is a function of the FILTER SET ONLY — it does
// not depend on the calling user's profile embedding or on pagination.
// So a single cached entry serves every user hitting the same filter
// combo (the common "no filters, sort=recommended" hot path is the
// extreme case: one entry serves the whole site for the TTL window).
//
// 60s TTL is short enough that newly synced jobs surface promptly and
// long enough to swallow burst traffic from a logged-in user clicking
// around. Auto-invalidated on every successful sync via
// `cache.invalidatePrefix('external_jobs:')` in externalJobService —
// see invalidateJobsCountCache() below, which the sync caller hits.
const jobsCountCache = new Map();
const JOBS_COUNT_CACHE_TTL_MS = 60 * 1000; // 60s
const JOBS_COUNT_CACHE_MAX_ENTRIES = 200;

function invalidateJobsCountCache() {
  jobsCountCache.clear();
}

// Per-user cache for the data /external-jobs needs out of Profile.
// Stores only what the ranking path consumes — the parsed embedding
// (number[]), the lowercased skill Set, and the profile primary key
// (needed for the legacy "no embedding yet, kick off a regen" branch).
//
// Why: every /external-jobs request was doing a Profile.findOne that
// reads the openaiEmbedding pgvector column (~4KB serialized as text)
// and then JSON.parse'd it. On warm-pool requests that's ~30-80ms; on
// cold-connection requests it competed for the same pool slot as the
// ANN+rank SELECT and stretched the user-visible latency. This cache
// collapses the entire profile read to an O(1) Map.get() on hit.
//
// 5 min TTL with invalidation on Profile.afterSave (see model hook).
// Embeddings are large but bounded (512 floats); 1000 users = ~2MB.
const profileForJobsCache = new Map();
const PROFILE_FOR_JOBS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PROFILE_FOR_JOBS_CACHE_MAX = 1000;

function _parseEmbeddingValue(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return null;
}

function _buildSkillSet(rawSkills) {
  const out = new Set();
  if (!rawSkills) return out;
  if (Array.isArray(rawSkills)) {
    for (const s of rawSkills) {
      const v = (typeof s === 'string' ? s : (s?.name || '')).toLowerCase().trim();
      if (v) out.add(v);
    }
  } else if (typeof rawSkills === 'object') {
    for (const arr of Object.values(rawSkills)) {
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
 * Cached read of the per-user data the /external-jobs ranking path
 * needs from Profile. Returns null when the user has no profile row.
 *
 * Shape: { profileId, hasEmbedding, profileEmbedding, skillSet }
 *   - profileEmbedding is null when the user's openaiEmbedding hasn't
 *     been persisted yet (legacy profiles before the column existed).
 *     The caller decides whether to kick off a background regen and
 *     fall through to the keyword path for the current request.
 *   - skillSet is always a Set<string> (possibly empty).
 *
 * Cache is invalidated by invalidateProfileForJobsCache(userId), called
 * from the Profile.afterSave hook whenever any embedding-relevant field
 * changes (title, summary, skills, experience, etc.).
 */
async function loadProfileForJobsRanking(userId) {
  if (!userId) return null;
  const cached = profileForJobsCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    // LRU touch so hot users stay in the cap.
    profileForJobsCache.delete(userId);
    profileForJobsCache.set(userId, cached);
    return cached.value;
  }
  // Lazy require to avoid the require cycle (Profile model →
  // afterSave → this service → Profile model).
  const { Profile } = require('../models');
  const row = await Profile.findOne({
    where: { userId },
    attributes: ['id', 'skills', 'openaiEmbedding'],
  });
  if (!row) {
    return null;
  }
  const value = {
    profileId: row.id,
    profileEmbedding: _parseEmbeddingValue(row.openaiEmbedding),
    skillSet: _buildSkillSet(row.skills),
  };
  if (profileForJobsCache.size >= PROFILE_FOR_JOBS_CACHE_MAX) {
    const oldest = profileForJobsCache.keys().next().value;
    if (oldest !== undefined) profileForJobsCache.delete(oldest);
  }
  profileForJobsCache.set(userId, {
    value,
    expiresAt: Date.now() + PROFILE_FOR_JOBS_CACHE_TTL_MS,
  });
  return value;
}

function invalidateProfileForJobsCache(userId) {
  if (!userId) return;
  profileForJobsCache.delete(userId);
}

// Simple hash to detect profile changes
function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return hash;
}

let openaiClient = null;

function getClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // Transient "Premature close" / "Invalid response body" errors are
      // undici connection drops to OpenAI — retryable. The SDK retries
      // APIConnectionError with exponential backoff; bump from the default 2
      // to 4 so a brief network blip doesn't surface to the caller (for the
      // search-embedding path that just means losing search-relevance blending
      // for that request). A 15s per-attempt timeout caps a hung socket far
      // below the SDK's 10-minute default so we fail fast and retry.
      maxRetries: 4,
      timeout: 15000,
    });
  }
  return openaiClient;
}

/**
 * Build embeddable text from a job's fields.
 * Keeps it focused on what matters for candidate matching.
 */
function buildJobText(job) {
  const parts = [];
  if (job.title) parts.push(`Title: ${job.title}`);
  if (job.company) parts.push(`Company: ${job.company}`);
  if (job.department) parts.push(`Department: ${job.department}`);
  if (job.location) parts.push(`Location: ${job.location}`);
  if (job.locationType) parts.push(`Work type: ${job.locationType}`);
  if (job.experienceLevel) parts.push(`Level: ${job.experienceLevel}`);

  // Skills
  if (job.skills && Array.isArray(job.skills) && job.skills.length > 0) {
    parts.push(`Skills: ${job.skills.join(', ')}`);
  }

  // Requirements (truncated)
  if (job.requirements) {
    parts.push(`Requirements: ${job.requirements.substring(0, 600)}`);
  }

  // Description (truncated — focus on first part which usually has role summary)
  if (job.description) {
    parts.push(`Description: ${job.description.substring(0, 800)}`);
  }

  return parts.join('. ');
}

/**
 * Generate embedding for a single job and store it.
 */
async function generateJobEmbedding(job) {
  const text = buildJobText(job);
  if (!text || text.length < 20) return null;

  try {
    const client = getClient();
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS
    });

    const embedding = response.data?.[0]?.embedding;
    if (!embedding) return null;

    await sequelize.query(
      `UPDATE "ExternalJobs" SET embedding = $1, "embeddingUpdatedAt" = NOW() WHERE id = $2`,
      {
        bind: [JSON.stringify(embedding), job.id],
        type: sequelize.constructor.QueryTypes.UPDATE
      }
    );

    return embedding;
  } catch (error) {
    console.error(`[JobEmbedding] Error for job ${job.id}:`, error.message);
    return null;
  }
}

/**
 * Generate embeddings for a batch of jobs efficiently.
 * Uses OpenAI batch embedding endpoint.
 * 
 * @param {Object[]} jobs - Array of ExternalJob instances/plain objects
 * @returns {{ success: number, failed: number }}
 */
async function generateBatchJobEmbeddings(jobs) {
  let success = 0;
  let failed = 0;
  const client = getClient();

  for (let i = 0; i < jobs.length; i += MAX_BATCH_SIZE) {
    const batch = jobs.slice(i, i + MAX_BATCH_SIZE);
    const texts = [];
    const validJobs = [];

    for (const job of batch) {
      const text = buildJobText(job);
      if (text && text.length >= 20) {
        texts.push(text);
        validJobs.push(job);
      } else {
        failed++;
      }
    }

    if (texts.length === 0) continue;

    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
        dimensions: EMBEDDING_DIMENSIONS
      });

      const updates = [];
      for (let j = 0; j < validJobs.length; j++) {
        const embedding = response.data?.[j]?.embedding;
        if (embedding) {
          updates.push(
            sequelize.query(
              `UPDATE "ExternalJobs" SET embedding = $1, "embeddingUpdatedAt" = NOW() WHERE id = $2`,
              {
                bind: [JSON.stringify(embedding), validJobs[j].id],
                type: sequelize.constructor.QueryTypes.UPDATE
              }
            ).then(() => { success++; })
          );
        } else {
          failed++;
        }
      }
      await Promise.all(updates);
    } catch (error) {
      console.error(`[JobEmbedding] Batch error at offset ${i}:`, error.message);
      failed += texts.length;
    }

    // Rate limit: small delay between batches
    if (i + MAX_BATCH_SIZE < jobs.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return { success, failed };
}

/**
 * Generate a query embedding for a candidate profile.
 * Builds a rich text representation that captures the candidate's specialization,
 * skill categories, experience roles, and location for accurate matching.
 * 
 * Caches embeddings per userId for 15 minutes to avoid repeated OpenAI calls.
 * Cache is invalidated early if the profile text content has changed.
 */
async function generateProfileQueryEmbedding(profile, userId) {
  const parts = [];
  if (profile.title) parts.push(`Current Role: ${profile.title}`);
  if (profile.headline) parts.push(`Headline: ${profile.headline}`);
  if (profile.location) parts.push(`Location: ${profile.location}`);

  // Include skill CATEGORIES + skill names — this is critical for
  // distinguishing "frontend developer" from "backend developer"
  const skills = profile.skills;
  if (skills) {
    if (Array.isArray(skills)) {
      const skillList = skills.map(s => typeof s === 'string' ? s : s.name || '').filter(Boolean);
      if (skillList.length > 0) parts.push(`Skills: ${skillList.join(', ')}`);
    } else if (typeof skills === 'object') {
      // Structured skills like { frontend: ["React", "TypeScript"], backend: ["Node.js"] }
      // Include both the category names AND the individual skills
      const categories = [];
      const allSkills = [];
      for (const [category, categorySkills] of Object.entries(skills)) {
        if (Array.isArray(categorySkills) && categorySkills.length > 0) {
          const validSkills = categorySkills.filter(s => typeof s === 'string');
          categories.push(category);
          allSkills.push(...validSkills);
          // Explicitly state category expertise e.g. "Frontend skills: React, TypeScript"
          parts.push(`${category} skills: ${validSkills.join(', ')}`);
        }
      }
      if (categories.length > 0) {
        parts.push(`Expertise areas: ${categories.join(', ')}`);
      }
    }
  }

  // Extract experience: position titles + companies (more context = better matching)
  if (Array.isArray(profile.experience) && profile.experience.length > 0) {
    const expEntries = profile.experience.slice(0, 5).map(e => {
      const pos = e.position || e.title || '';
      const comp = e.company || '';
      return pos && comp ? `${pos} at ${comp}` : pos || comp;
    }).filter(Boolean);
    if (expEntries.length > 0) parts.push(`Work experience: ${expEntries.join('; ')}`);
  }

  if (profile.summary) parts.push(`Summary: ${profile.summary.substring(0, 500)}`);

  const text = parts.join('. ');
  if (!text || text.length < 10) return null;

  // Check cache: reuse if same user + same profile content + not expired
  const cacheKey = `profile:${userId || 'anon'}`;
  const textHash = hashText(text);
  const cached = profileEmbeddingCache.get(cacheKey);
  if (cached && cached.textHash === textHash && cached.expiresAt > Date.now()) {
    return cached.embedding;
  }

  try {
    const client = getClient();
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS
    });
    const embedding = response.data?.[0]?.embedding || null;

    // Store in cache
    if (embedding && userId) {
      profileEmbeddingCache.set(cacheKey, {
        embedding,
        textHash,
        expiresAt: Date.now() + PROFILE_CACHE_TTL_MS
      });
      // Evict old entries to prevent memory leaks (keep max 500 users)
      if (profileEmbeddingCache.size > 500) {
        const firstKey = profileEmbeddingCache.keys().next().value;
        profileEmbeddingCache.delete(firstKey);
      }
    }

    return embedding;
  } catch (error) {
    console.error(`[JobEmbedding] Profile query embedding error:`, error.message);
    return null;
  }
}

/**
 * Generate AND PERSIST a profile's OpenAI embedding to the row.
 *
 * Called from the Profile.afterSave hook whenever a relevant field changes
 * (title, headline, summary, skills, aiKeywords, experience). Lets the
 * candidate-side jobs page read `profile.openaiEmbedding` directly instead
 * of regenerating it on every request.
 *
 * Returns the stored embedding (or null if generation failed).
 * Errors are caught and logged — never thrown — because this runs from a
 * hook and must not block the user's profile save.
 */
async function regenerateProfileOpenAIEmbedding(profile) {
  if (!profile || !profile.id) return null;
  if (!process.env.OPENAI_API_KEY) return null;

  // Reuse the same text representation generateProfileQueryEmbedding builds,
  // so the persisted embedding ranks jobs identically to the legacy
  // per-request flow.
  const embedding = await generateProfileQueryEmbedding(profile, profile.userId || profile.id);
  if (!embedding) return null;

  try {
    // Sequelize doesn't natively know how to bind VECTOR arrays through the
    // model.update() path on every dialect — use a bound raw query.
    await sequelize.query(
      `UPDATE "Profiles"
       SET "openaiEmbedding" = $1::vector,
           "openaiEmbeddingUpdatedAt" = NOW()
       WHERE id = $2`,
      {
        bind: [`[${embedding.join(',')}]`, profile.id],
        type: sequelize.constructor.QueryTypes.UPDATE,
      }
    );
    return embedding;
  } catch (error) {
    console.error(`[JobEmbedding] Failed to persist OpenAI embedding for profile ${profile.id}:`, error.message);
    return null;
  }
}

/**
 * Generate an embedding for a raw search query string.
 * Used to rank jobs by how well they match the user's search terms.
 *
 * Cached in-process for SEARCH_CACHE_TTL_MS so repeated searches for
 * the same term don't roundtrip to OpenAI. Cache is keyed on the
 * normalized query (trim + lower-case) so "Frontend" and "frontend "
 * share an entry. Cache is server-wide (no userId) because the
 * embedding is purely a function of the query text.
 */
async function generateSearchQueryEmbedding(searchText) {
  if (!searchText || searchText.trim().length < 2) return null;
  const normalized = searchText.trim().toLowerCase();
  const cacheKey = `search:${normalized}`;

  const cached = searchEmbeddingCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.embedding;
  }

  try {
    const client = getClient();
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: searchText.trim(),
      dimensions: EMBEDDING_DIMENSIONS
    }, {
      // CRITICAL: this call is on the user's request critical path — the
      // /external-jobs search route awaits it before ranking. So it must
      // fail FAST, not resiliently: a tight 2.5s timeout and a single retry
      // cap the worst case at ~5s, after which the caller proceeds with
      // lexical (searchTsvAB) + profile-vector ranking and the next request
      // for the same term uses the cached vector. (The background job-
      // embedding path keeps the client's resilient maxRetries=4/15s default,
      // where latency is irrelevant.) Without this override the client-level
      // settings could stack 4 retries × 15s on a flaky connection and hang
      // the search request for a minute.
      timeout: 2500,
      maxRetries: 1,
    });
    const embedding = response.data?.[0]?.embedding || null;

    if (embedding) {
      searchEmbeddingCache.set(cacheKey, {
        embedding,
        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
      });
      // FIFO eviction: Map preserves insertion order, so delete the
      // oldest entry when we cross the bound. This is O(1) amortized.
      if (searchEmbeddingCache.size > SEARCH_CACHE_MAX_ENTRIES) {
        const firstKey = searchEmbeddingCache.keys().next().value;
        searchEmbeddingCache.delete(firstKey);
      }
    }

    return embedding;
  } catch (error) {
    // Non-fatal: the caller falls back to profile-only ranking (no search-
    // relevance blending) for this request. Logged at warn since it's an
    // expected, recoverable transient (OpenAI connection drop) after the
    // client's own retries are exhausted — not an error needing attention.
    console.warn(`[JobEmbedding] Search query embedding unavailable (transient): ${error.message}`);
    return null;
  }
}

/**
 * Semantic job search: find jobs most similar to a candidate profile.
 * Uses pgvector cosine distance for fast similarity scoring.
 * 
 * @param {number[]} profileEmbedding - 512-dim profile embedding vector
 * @param {Object} options - Search options
 * @param {number} options.limit - Max results
 * @param {Object} options.where - Additional SQL conditions
 * @returns {Object[]} - Jobs with relevanceScore (0-100)
 */
async function searchSimilarJobs(profileEmbedding, options = {}) {
  const { limit = 100, offset = 0, locationType = null, location = null, search = null, searchEmbedding = null, datePosted = null, company = null, experienceLevel = null, employmentType = null, department = null, skills = null, startup = false, salaryMin = null, salaryMax = null, sortMode = 'recommended' } = options;
  const { NON_STARTUP_COMPANIES, NON_STARTUP_FUNDING_STAGES } = require('../utils/startupClassifier');

  const conditions = [
    `ej."isActive" = true`,
    `ej.embedding IS NOT NULL`
  ];
  // $1 = profileEmbedding, $2 = limit, $3 = offset, optional $4+ for filters
  const binds = [JSON.stringify(profileEmbedding), limit, offset];
  let bindIndex = 4;

  // If searchEmbedding is provided, it goes in as the next bind slot
  let searchEmbBindIdx = null;
  if (searchEmbedding) {
    searchEmbBindIdx = bindIndex;
    binds.push(JSON.stringify(searchEmbedding));
    bindIndex++;
  }

  if (locationType) {
    conditions.push(`ej."locationType" = $${bindIndex}`);
    binds.push(locationType);
    bindIndex++;
  }

  if (location) {
    // Expand a major hub to its whole commute metro (San Francisco → San
    // Mateo / Foster City / San Jose / Bay Area …) so the filter doesn't drop
    // the in-area jobs that spell their location differently. Keep in sync with
    // routes/externalJobs.js. Unknown locations fall back to a single match.
    const locPatterns = expandLocationAliases(location);
    if (locPatterns.length > 1) {
      const ors = locPatterns.map(p => {
        binds.push(`%${p}%`);
        return `ej.location ILIKE $${bindIndex++}`;
      });
      conditions.push(`(${ors.join(' OR ')})`);
    } else {
      conditions.push(`ej.location ILIKE $${bindIndex}`);
      binds.push(`%${locPatterns[0] || location}%`);
      bindIndex++;
    }
  }

  if (company) {
    conditions.push(`ej.company ILIKE $${bindIndex}`);
    binds.push(`%${company}%`);
    bindIndex++;
  }

  if (experienceLevel) {
    // LENIENT NULL policy — mirror routes/externalJobs.js: experienceLevel is
    // inferred from the title and is null whenever no seniority keyword is
    // present, so match the requested level OR an unknown (null) level rather
    // than excluding every keyword-less role.
    conditions.push(`(ej."experienceLevel" = $${bindIndex} OR ej."experienceLevel" IS NULL)`);
    binds.push(experienceLevel);
    bindIndex++;
  }

  if (employmentType) {
    // LENIENT NULL policy — mirror routes/externalJobs.js: employmentType is
    // sparsely/unreliably populated, so match jobs with the type OR no type.
    conditions.push(`(ej."employmentType" IS NULL OR ej."employmentType" = $${bindIndex})`);
    binds.push(employmentType);
    bindIndex++;
  }

  if (department) {
    conditions.push(`ej.department ILIKE $${bindIndex}`);
    binds.push(`%${department}%`);
    bindIndex++;
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
      // Greenhouse jobs store postedAt = NULL by design (see normalizeGreenhouseJob).
      // Fall back to createdAt so the date filter matches the UI label, which
      // already uses COALESCE(postedAt, createdAt).
      conditions.push(`COALESCE(ej."postedAt", ej."createdAt") >= $${bindIndex}`);
      binds.push(dateMap[datePosted].toISOString());
      bindIndex++;
    }
  }

  if (search) {
    if (searchEmbedding) {
      // Semantic mode: we have a vector for the search query, so cosine
      // similarity (in scoreExpr below) already ranks by semantic
      // relevance. The role of the typed query here is only to keep the
      // candidate set on-topic — not to be the primary filter.
      //
      // The typed query must keep the candidate set on-topic. We use AND
      // semantics on prefix-stemmed tokens: EVERY token must hit title/
      // company/department. This is the relevance fix — OR semantics let
      // "Frontend Engineer" match every "…Engineer" (Backend, Data, ML…),
      // and cosine ranking could not always push those off-target roles
      // down far enough, so results felt inaccurate.
      //
      // Prefix-stemming (`token:*`) preserves the useful looseness AND
      // needs — "Frontend Engineer" still matches "Frontend Engineering",
      // "Frontend Software Engineer", etc. — while requiring all concepts
      // to be present. The frontend already trims seniority prefixes
      // ("Senior Frontend Engineer" → "Frontend Engineer") before seeding
      // the search box, so AND does not over-restrict on common queries.
      // Cosine similarity (scoreExpr) then ranks within this tight pool.
      //
      // Tokens are sanitized to [a-z0-9]+ so user input can't break
      // to_tsquery syntax (quotes / colons / parens are stripped at the
      // JS layer; the value is also passed via a bind, not interpolated).
      const queryTokens = String(search)
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .map(t => t.replace(/[^a-z0-9]/g, ''))
        .filter(t => t.length >= 2)
        .slice(0, 8); // cap so a giant paste can't blow up the query

      if (queryTokens.length > 0) {
        const tsqExpr = queryTokens.map(t => `${t}:*`).join(' & ');
        // Require an A (title) or B (company/dept) weight hit, excluding
        // description-only matches. searchTsvAB is a STORED generated
        // tsvector that contains ONLY title (A) + company/dept (B) — no
        // description — so a single GIN-indexable `@@` enforces that rule
        // natively, with no per-row ts_rank_cd (which on common terms timed
        // the query out). See ensureExternalJobPerfSchema.js.
        conditions.push(`ej."searchTsvAB" @@ to_tsquery('english', $${bindIndex})`);
        binds.push(tsqExpr);
        bindIndex++;
      }
      // If sanitization stripped everything (e.g. pure symbols), let
      // cosine similarity handle the ranking alone — the search embedding
      // still carries the semantic intent. else {
      // No embedding available: weighted full-text via the searchTsv
      // generated column + GIN index. Title hits rank highest (weight A),
      // company/dept mid (B), description low (C).
      // plainto_tsquery ANDs every token, which keeps results tight on
      // intentional multi-word inputs. The frontend trims seniority
      // prefixes from the auto-detected role before seeding the search
      // box (so "Senior Frontend Engineer" → "Frontend Engineer"), which
      // avoids the AND-too-restrictive trap.
      conditions.push(`ej."searchTsv" @@ plainto_tsquery('english', $${bindIndex})`);
      binds.push(search);
      bindIndex++;
    }
  }

  // Skill containment filter — backed by GIN index (jsonb_path_ops). The
  // `@>` operator returns true iff the job's skills array contains all of
  // the requested tokens (AND semantics). Empty arrays in `skills` short-
  // circuit the filter so we don't accidentally exclude every job.
  if (Array.isArray(skills) && skills.length > 0) {
    conditions.push(`ej."skills" @> $${bindIndex}::jsonb`);
    binds.push(JSON.stringify(skills));
    bindIndex++;
  }

  // Startup filter (mirrors routes/externalJobs.js — keep in sync). A job is
  // a "startup" job when:
  //   - its source board is flagged ATSBoards.isStartup = true (boards found
  //     by the YC / VC-portfolio crawl), probed via the unique
  //     (platform, boardToken) index, OR
  //   - it came from HackerNews "Who is hiring" (source = 'hn_hiring').
  // The old `source IN (greenhouse,lever,ashby,…)` heuristic was a no-op
  // (~27k/36k jobs passed, incl. Airbnb/Roblox). Hand-seeded boards (known,
  // mostly-large companies) are isStartup = false, so excluded by the flag.
  //
  // Defense-in-depth, unconditionally:
  //   - company name is NOT on the curated non-startup deny-list.
  //   - the linked Company's funding stage is NOT late/IPO/Series D+.
  if (startup) {
    conditions.push(`(
      ej."source" = 'hn_hiring'
      OR EXISTS (
        SELECT 1 FROM "ATSBoards" ats
        WHERE ats."platform"::text = ej."source"::text
          AND ats."boardToken" = ej."boardToken"
          AND ats."isStartup" = true
      )
    )`);
    // Hard deny-list on company name. Bound as a text[] so PostgreSQL
    // can hash-probe instead of evaluating a long OR chain, and so the
    // values are properly escaped.
    conditions.push(`LOWER(COALESCE(ej."company", '')) <> ALL($${bindIndex}::text[])`);
    binds.push(NON_STARTUP_COMPANIES);
    bindIndex++;
    // Hard exclusion of late-stage / IPO / acquired companies regardless
    // of the flag — catches a discovery company that has since grown large.
    // NULL fundingStage falls through (most ExternalJobs rows have no linked
    // Company enrichment yet — those still pass on the board flag).
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM "Companies" c2
      WHERE c2.id = ej."companyId"
        AND LOWER(COALESCE(c2."fundingStage", '')) = ANY($${bindIndex}::text[])
    )`);
    binds.push(NON_STARTUP_FUNDING_STAGES);
    bindIndex++;
  }

  // Salary band filter. We treat the band as an overlap test against the
  // job's declared [salaryMin, salaryMax] range:
  //   - user said "$200k+"  → salaryMin=200000  → job.salaryMax >= 200000
  //   - user said "≤ $250k" → salaryMax=250000  → job.salaryMin <= 250000
  //
  // LENIENT NULL policy: only ~1.5% of the corpus lists a salary, so
  // *excluding* unlisted-salary jobs emptied almost every salary-filtered
  // result set. We instead INCLUDE jobs with no listed salary (NULL passes
  // the band test). Keep this in sync with routes/externalJobs.js so the
  // count + result queries never diverge.
  if (salaryMin != null && !Number.isNaN(Number(salaryMin))) {
    conditions.push(`(ej."salaryMax" IS NULL OR ej."salaryMax" >= $${bindIndex})`);
    binds.push(parseInt(salaryMin, 10));
    bindIndex++;
  }
  if (salaryMax != null && !Number.isNaN(Number(salaryMax))) {
    conditions.push(`(ej."salaryMin" IS NULL OR ej."salaryMin" <= $${bindIndex})`);
    binds.push(parseInt(salaryMax, 10));
    bindIndex++;
  }

  const whereClause = conditions.join(' AND ');

  // ── COUNT first: it drives the query-plan choice below ──────────────────
  // Count query shares the same WHERE conditions but doesn't use $1 (embedding),
  // $2 (limit), $3 (offset), or the optional searchEmbedding bind. We must
  // re-index the filter-only params so PostgreSQL gets the right bind count.
  // filterBinds holds only the values for $4+ (filters); we remap $4→$1, $5→$2, etc.
  const filterBindStartIndex = searchEmbedding ? 5 : 4; // $4 or $5 depending on searchEmbedding
  const filterBinds = binds.slice(filterBindStartIndex - 1); // 0-based: slice(3) or slice(4)

  // Rebuild WHERE clause with re-indexed bind params for the count query
  let countWhereClause = whereClause;
  for (let oldIdx = filterBindStartIndex, newIdx = 1; oldIdx <= binds.length; oldIdx++, newIdx++) {
    // Replace $N with re-indexed $M (use word boundary to avoid $10 matching $1)
    countWhereClause = countWhereClause.replace(
      new RegExp(`\\$${oldIdx}(?![0-9])`, 'g'),
      `__BIND_${newIdx}__`
    );
  }
  // Now replace placeholders with final $N
  countWhereClause = countWhereClause.replace(/__BIND_(\d+)__/g, (_, n) => `$${n}`);

  const countQuery = `
    SELECT COUNT(*) as total
    FROM "ExternalJobs" ej
    WHERE ${countWhereClause}
  `;

  // Run the count up front (filter-signature keyed cache, user-independent —
  // the count is identical for every user with the same filter set). The
  // total tells us whether HNSW is even worth using: pgvector's HNSW index is
  // only fast when the post-WHERE filter is BROAD. It walks the graph in
  // similarity order and discards rows failing the filter, so a HIGHLY
  // SELECTIVE filter (e.g. startup + a specific city + a search term that
  // together match only a few hundred of 36k jobs) forces it to traverse
  // almost the entire graph to fill the candidate pool — that's slower than a
  // plain filtered scan and is the cause of the multi-second/timeout
  // responses. So when the filtered set is small we skip HNSW and rank the
  // small set directly (a filtered seqscan + cosine over a few hundred rows is
  // milliseconds); HNSW is reserved for the broad-filter case where it pays.
  const countCacheKey = `${countWhereClause}|${JSON.stringify(filterBinds)}`;
  const cachedCount = jobsCountCache.get(countCacheKey);
  const countFreshEnough = cachedCount && cachedCount.expiresAt > Date.now();
  let total;
  if (countFreshEnough) {
    total = cachedCount.total;
  } else {
    const countResult = await sequelize.query(countQuery, {
      bind: filterBinds,
      type: sequelize.constructor.QueryTypes.SELECT,
    });
    total = parseInt(countResult[0]?.total) || 0;
    // Cap entries to keep memory bounded; FIFO eviction is fine since hot
    // filter combos are revisited continuously and stay warm.
    if (jobsCountCache.size >= JOBS_COUNT_CACHE_MAX_ENTRIES) {
      const oldest = jobsCountCache.keys().next().value;
      if (oldest !== undefined) jobsCountCache.delete(oldest);
    }
    jobsCountCache.set(countCacheKey, {
      total,
      expiresAt: Date.now() + JOBS_COUNT_CACHE_TTL_MS,
    });
  }

  // Below this many matching rows, the direct (non-HNSW) ranked scan is faster
  // AND more accurate than HNSW-with-post-filter (which would have to scan the
  // whole graph to fill a pool of a few thousand anyway). The ANN pool caps at
  // 3000, so a set already at/under that gains nothing from HNSW.
  const SMALL_SET_THRESHOLD = 5000;

  // Match score (the % shown in the UI badge) stays as a pure profile-fit
  // signal. Sorting uses a SEPARATE rank score that multiplies the match
  // by a recency factor so fresh-and-relevant jobs land at the very top —
  // not just relevant. This is what the user sees as "most recent and
  // related on top" without watering down what the badge percentage means.
  let scoreExpr;
  if (searchEmbBindIdx) {
    // Blended score: 70% search relevance + 30% profile relevance
    scoreExpr = `ROUND(
      (0.7 * (1 - (ej.embedding <=> $${searchEmbBindIdx}::vector))
       + 0.3 * (1 - (ej.embedding <=> $1::vector)))
      * 100
    )`;
  } else {
    scoreExpr = `ROUND((1 - (ej.embedding <=> $1::vector)) * 100)`;
  }

  // 'recommended' ordering goal: a candidate (e.g. a SF Frontend dev) opening
  // the jobs page should see the LATEST posted RELEVANT jobs on top — i.e.
  // strict newest-first ordering AMONG the jobs that actually match their
  // profile, with off-target roles (recruiter, design, sales) kept out of the
  // top. Uses COALESCE(postedAt, createdAt) because Greenhouse jobs store
  // postedAt = NULL (see normalizeGreenhouseJob comment).
  const recencyOrderExpr = `COALESCE(ej."postedAt", ej."createdAt") DESC NULLS LAST`;

  // Relevance band: bucket the (compressed, ~50-70) cosine match score into
  // 5-POINT bands, then order strictly by DATE within each band. 5 points is
  // the sweet spot for this score range:
  //   - It SEPARATES a candidate's real matches from the noise: for a SF
  //     Frontend dev, Frontend/Full-Stack roles score ~65-69 (band 13) while
  //     Recruiter/Design/Sales score ~60-62 (band 12). Band 13 is strictly
  //     above band 12, so the noise never reaches the top.
  //   - WITHIN the top band it ignores tiny score deltas (65 vs 69 are the
  //     same band), so pure date wins → ALL the latest frontend jobs sort to
  //     the top newest-first, which is exactly what the user expects.
  // (A 10-point band was too coarse — it merged 60-69 into one bucket, so a
  // 60% recruiter could ride date above a 66% frontend role. A pure additive
  // recency bonus was too weak — a 69% from 3 weeks ago still edged out a
  // fresher 67%, so it didn't read as "latest on top".)
  const matchBandExpr = `FLOOR((${scoreExpr}) / 5.0)`;

  // ORDER BY differs by sort mode:
  //   recommended → relevance band, then latest posted, then exact score
  //   match       → match score, recency tiebreak
  //   recent      → recency, match tiebreak
  let orderExpr;
  if (sortMode === 'match') {
    orderExpr = `${scoreExpr} DESC, ${recencyOrderExpr}`;
  } else if (sortMode === 'recent') {
    orderExpr = `${recencyOrderExpr}, ${scoreExpr} DESC`;
  } else {
    // recommended (default): RELEVANCE BAND then DATE. Group jobs into 5-point
    // match bands (best band first), and within each band put the latest
    // posted job on top. This delivers "all latest posted relevant jobs on
    // top": the candidate's real matches (top band) lead, ordered newest-
    // first, while off-target roles sit in a lower band and never jump the
    // queue on freshness alone. Exact score is the final tiebreak so equally-
    // fresh jobs in a band still order by match strength.
    orderExpr = `${matchBandExpr} DESC, ${recencyOrderExpr}, ${scoreExpr} DESC`;
  }

  // ── Two-stage retrieval for vector-ranked sort modes ──
  // The HNSW index on ExternalJobs.embedding can only be used when ORDER BY
  // is a *pure* cosine distance expression (`embedding <=> $1::vector`). In
  // `recommended` and `match` modes the ORDER BY is a composite (freshness
  // tier + rank score), which forces the planner to fall back to a sequential
  // scan computing cosine for every matching row — on a 13k+ corpus that's
  // hundreds of ms at best, and stacks to multi-second / Render-timeout
  // territory under concurrent requests with filters applied.
  //
  // Fix: run an HNSW-indexed ANN query first to narrow to a candidate pool,
  // then apply the composite ordering on that small set. The pool is sized
  // generously enough that (a) pagination through ~25 pages still works and
  // (b) freshness re-ranking has enough non-top-cosine jobs to shuffle.
  //
  // 'recent' bypasses this — pure date ordering uses the
  // (isActive, postedAt DESC) composite index directly; cosine is only
  // a tiebreaker computed on the already LIMIT-clamped result set.
  const needsAnn = sortMode !== 'recent' && total > SMALL_SET_THRESHOLD;
  // POOL = max(500, (limit + offset) * 3), capped at 3000. Allows ~25
  // pages of 20 results; cap keeps the worst case bounded.
  const annPoolExpr = `LEAST(GREATEST(500, ($2::int + $3::int) * 3), 3000)`;

  // Freshness-pool size for 'recommended' mode. See the UNION rationale
  // below; sized smaller than the ANN pool since it only needs to seed the
  // newest few hundred matching jobs into the candidate set.
  const recencyPoolExpr = `LEAST(GREATEST(300, ($2::int + $3::int) * 2), 1500)`;

  // In 'recommended' mode the final ORDER BY tiers by freshness FIRST. But
  // the candidate CTE below only narrowed to the top-N jobs by *cosine
  // similarity to the profile* — so a brand-new posting that isn't already
  // among the candidate's strongest matches never enters the pool and can
  // never reach the freshness tiers, no matter how recent it is. As the
  // corpus grows the similarity bar to enter the top-N keeps rising, which
  // is exactly why fresh listings stop surfacing and the list "looks
  // stale". Fix: UNION the cosine-ANN pool with a recency pool (newest
  // matching jobs) so genuinely-new postings are always candidates and the
  // freshness tiering can lift them. 'match' mode keeps the pure ANN pool
  // (relevance is the whole point there); 'recent' bypasses the CTE.
  const unionRecency = sortMode === 'recommended';
  const candidateCte = unionRecency
    ? `
    WITH ann_candidates AS (
      (
        SELECT ej.id
        FROM "ExternalJobs" ej
        WHERE ${whereClause}
        ORDER BY ej.embedding <=> $1::vector
        LIMIT ${annPoolExpr}
      )
      UNION
      (
        SELECT ej.id
        FROM "ExternalJobs" ej
        WHERE ${whereClause}
        ORDER BY COALESCE(ej."postedAt", ej."createdAt") DESC NULLS LAST
        LIMIT ${recencyPoolExpr}
      )
    )`
    : `
    WITH ann_candidates AS (
      SELECT ej.id
      FROM "ExternalJobs" ej
      WHERE ${whereClause}
      ORDER BY ej.embedding <=> $1::vector
      LIMIT ${annPoolExpr}
    )`;

  const query = needsAnn ? `${candidateCte}
    SELECT 
      ej.id, ej."externalId", ej.source, ej."boardToken", ej.title, ej.company,
      ej.location, ej."locationType", ej."employmentType", ej."experienceLevel",
      ej.department, ej.description, ej.requirements, ej.skills,
      ej."salaryMin", ej."salaryMax", ej."salaryCurrency", ej."salaryPeriod",
      ej."applyUrl", ej."sourceUrl", ej."postedAt", ej."isActive",
      ej."lastFetchedAt", ej."createdAt", ej."updatedAt",
      ${scoreExpr} as "relevanceScore",
      json_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug, 'domain', c.domain,
        'logoUrl', c."logoUrl", 'website', c.website, 'industry', c.industry,
        'employeeCount', c."employeeCount", 'employeeRange', c."employeeRange",
        'fundingStage', c."fundingStage", 'headquarters', c.headquarters,
        'linkedinUrl', c."linkedinUrl"
      ) as "companyInfo"
    FROM "ExternalJobs" ej
    JOIN ann_candidates ac ON ac.id = ej.id
    LEFT JOIN "Companies" c ON ej."companyId" = c.id
    ORDER BY ${orderExpr}, ej."createdAt" DESC
    LIMIT $2 OFFSET $3
  ` : `
    SELECT 
      ej.id, ej."externalId", ej.source, ej."boardToken", ej.title, ej.company,
      ej.location, ej."locationType", ej."employmentType", ej."experienceLevel",
      ej.department, ej.description, ej.requirements, ej.skills,
      ej."salaryMin", ej."salaryMax", ej."salaryCurrency", ej."salaryPeriod",
      ej."applyUrl", ej."sourceUrl", ej."postedAt", ej."isActive",
      ej."lastFetchedAt", ej."createdAt", ej."updatedAt",
      ${scoreExpr} as "relevanceScore",
      json_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug, 'domain', c.domain,
        'logoUrl', c."logoUrl", 'website', c.website, 'industry', c.industry,
        'employeeCount', c."employeeCount", 'employeeRange', c."employeeRange",
        'fundingStage', c."fundingStage", 'headquarters', c.headquarters,
        'linkedinUrl', c."linkedinUrl"
      ) as "companyInfo"
    FROM "ExternalJobs" ej
    LEFT JOIN "Companies" c ON ej."companyId" = c.id
    WHERE ${whereClause}
    ORDER BY ${orderExpr}, ej."createdAt" DESC
    LIMIT $2 OFFSET $3
  `;

  // hnsw.ef_search is now configured per-connection via the database
  // pool's afterConnect hook (see backend/config/database.js). We used to
  // wrap the ANN SELECT in `sequelize.transaction()` just to scope
  // `SET LOCAL hnsw.ef_search = 200`, which cost a BEGIN/COMMIT round-
  // trip on every request — measurable on the /external-jobs hot path
  // since it also locked the connection from the parallel COUNT(*).
  // The setting is harmless when the query doesn't use HNSW.
  try {
    const t0 = Date.now();
    const results = await sequelize.query(query, {
      bind: binds,
      type: sequelize.constructor.QueryTypes.SELECT,
    });
    const listMs = Date.now() - t0;

    // Log when a request gets visibly slow so we can spot regressions in
    // prod logs. 1500ms is generous (typical good runs are 30-150ms) but
    // catches the multi-second outliers the user actually feels.
    if (listMs > 1500) {
      console.warn(
        `[JobEmbedding] slow searchSimilarJobs: ${listMs}ms ` +
        `(needsAnn=${needsAnn}, total=${total}, ` +
        `filters=${filterBinds.length}, search=${!!search})`
      );
    }

    return {
      rows: results.map(row => ({
        ...row,
        relevanceScore: Math.max(0, Math.min(100, parseInt(row.relevanceScore) || 0)),
        companyInfo: row.companyInfo?.id ? row.companyInfo : null
      })),
      total
    };
  } catch (error) {
    // Don't swallow: returning empty rows on a SQL error masks broken
    // schema (e.g. missing searchTsv column, type mismatch on the
    // vector cast) as "no results", which produces an empty /jobs
    // page that looks identical to a normal-but-no-match query.
    // Re-throw so the route handler can decide — typically log + 500.
    // We still log here for fast triage in Render logs.
    console.error(`[JobEmbedding] Semantic search error:`, error.message);
    if (error.parent?.message) console.error(`[JobEmbedding] parent:`, error.parent.message);
    throw error;
  }
}

module.exports = {
  buildJobText,
  generateJobEmbedding,
  generateBatchJobEmbeddings,
  generateProfileQueryEmbedding,
  generateSearchQueryEmbedding,
  regenerateProfileOpenAIEmbedding,
  searchSimilarJobs,
  invalidateJobsCountCache,
  loadProfileForJobsRanking,
  invalidateProfileForJobsCache,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS
};
