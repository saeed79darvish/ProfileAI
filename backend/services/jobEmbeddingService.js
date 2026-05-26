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
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
    console.error(`[JobEmbedding] Search query embedding error:`, error.message);
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
    conditions.push(`ej.location ILIKE $${bindIndex}`);
    binds.push(`%${location}%`);
    bindIndex++;
  }

  if (company) {
    conditions.push(`ej.company ILIKE $${bindIndex}`);
    binds.push(`%${company}%`);
    bindIndex++;
  }

  if (experienceLevel) {
    conditions.push(`ej."experienceLevel" = $${bindIndex}`);
    binds.push(experienceLevel);
    bindIndex++;
  }

  if (employmentType) {
    conditions.push(`ej."employmentType" = $${bindIndex}`);
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
      // We used to require an AND match against title/company/department
      // via plainto_tsquery, which over-restricted multi-word searches:
      //   "Software Architect" → had to contain BOTH "software" + "architect"
      //   in title/company/dept, so "Solutions Architect", "Cloud Architect",
      //   "Principal Architect", "Staff Engineer, Architecture" were all
      //   excluded even though their embedding is highly similar.
      //
      // Switch to OR semantics on prefix-stemmed tokens: any single token
      // hit in title/company/dept is enough. Cosine similarity then ranks
      // within that pool, so good fits still float to the top and obvious
      // mismatches sink. We sanitize tokens to [a-z0-9]+ so user input
      // can't break to_tsquery syntax (single quotes / colons / parens
      // are stripped at the JS layer; the value is also passed via a
      // bind, not interpolated).
      const orTokens = String(search)
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .map(t => t.replace(/[^a-z0-9]/g, ''))
        .filter(t => t.length >= 2)
        .slice(0, 8); // cap so a giant paste can't blow up the query

      if (orTokens.length > 0) {
        const tsqExpr = orTokens.map(t => `${t}:*`).join(' | ');
        conditions.push(`(
          setweight(to_tsvector('english', coalesce(ej."title", '')), 'A') ||
          setweight(to_tsvector('english', coalesce(ej."company", '')), 'B') ||
          setweight(to_tsvector('english', coalesce(ej."department", '')), 'B')
        ) @@ to_tsquery('english', $${bindIndex})`);
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

  // Startup filter (mirrors routes/externalJobs.js logic). True when:
  //   - source is one of the startup-leaning boards (HN, Lever, Ashby,
  //     WeWorkRemotely, RemoteOK, TheirStack), OR
  //   - linked Company has employeeCount < 500, OR
  //   - linked Company employeeRange is small (1-10 / 11-50 / 51-200 / 201-500), OR
  //   - linked Company has early-stage funding.
  //
  // AND, unconditionally:
  //   - the company name is NOT on the curated non-startup deny-list
  //     (Stripe, OpenAI, Anthropic, Databricks, Twilio, etc.) — these
  //     are technically private but read as "big tech" to candidates.
  //   - the linked Company's funding stage is NOT late/IPO/Series D+
  //     (which would also let through unicorns the deny-list misses).
  if (startup) {
    conditions.push(`(
      ej."source" IN ('hn_hiring','lever','ashby','wwr','remoteok','theirstack')
      OR EXISTS (
        SELECT 1 FROM "Companies" c
        WHERE c.id = ej."companyId"
          AND (
            (c."employeeCount" IS NOT NULL AND c."employeeCount" < 500)
            OR c."employeeRange" IN ('1-10','11-50','51-200','201-500')
            OR LOWER(COALESCE(c."fundingStage", '')) IN
               ('pre-seed','preseed','seed','series-a','series_a','series a','series-b','series_b','series b','series-c','series_c','series c')
          )
      )
    )`);
    // Hard deny-list on company name. Bound as a text[] so PostgreSQL
    // can hash-probe instead of evaluating a long OR chain, and so the
    // values are properly escaped.
    conditions.push(`LOWER(COALESCE(ej."company", '')) <> ALL($${bindIndex}::text[])`);
    binds.push(NON_STARTUP_COMPANIES);
    bindIndex++;
    // Hard exclusion of late-stage / IPO / acquired companies regardless
    // of which arm of the OR above matched. NULL fundingStage falls
    // through (most ExternalJobs rows have no linked Company enrichment
    // yet — those still pass the source/employee arms).
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
  // Strict NULL policy: jobs that don't list a salary are *excluded*
  // from a salary-filtered result set. Lenient ("include unlisted")
  // would silently inflate counts and let through low-paying roles the
  // candidate is explicitly trying to filter out, which destroys trust
  // in the count badge. If we ever change this, change it in BOTH this
  // service AND routes/externalJobs.js so the count + result queries
  // never diverge.
  if (salaryMin != null && !Number.isNaN(Number(salaryMin))) {
    conditions.push(`ej."salaryMax" IS NOT NULL AND ej."salaryMax" >= $${bindIndex}`);
    binds.push(parseInt(salaryMin, 10));
    bindIndex++;
  }
  if (salaryMax != null && !Number.isNaN(Number(salaryMax))) {
    conditions.push(`ej."salaryMin" IS NOT NULL AND ej."salaryMin" <= $${bindIndex}`);
    binds.push(parseInt(salaryMax, 10));
    bindIndex++;
  }

  const whereClause = conditions.join(' AND ');

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

  // Recency factor — strong multiplicative penalty for older jobs so
  // fresh + relevant rises to the top in 'recommended' mode. Floor at 0.5
  // so an older job that's a perfect match isn't completely buried.
  //   0 days old:  factor = 1.00 (no penalty)
  //   3 days:      factor ≈ 0.89
  //   7 days:      factor = 0.75
  //  14+ days:     factor = 0.50 (floor)
  // Uses COALESCE(postedAt, createdAt) because Greenhouse jobs store
  // postedAt = NULL (see normalizeGreenhouseJob comment).
  const recencyFactorExpr = `
    GREATEST(0.5, 1.0 - LEAST(
      EXTRACT(EPOCH FROM (NOW() - COALESCE(ej."postedAt", ej."createdAt"))) / 86400.0,
      14
    ) / 28.0)
  `.trim();
  const rankScoreExpr = `(${scoreExpr}) * ${recencyFactorExpr}`;
  const recencyOrderExpr = `COALESCE(ej."postedAt", ej."createdAt") DESC NULLS LAST`;

  // Freshness buckets — in Recommended mode we tier jobs by recency so the
  // candidate sees the newest matches first while still seeing older,
  // still-relevant jobs below. Within each bucket we sort by match score
  // so the most relevant fresh job is always at the very top.
  //
  //   tier 3: posted in the last hour      (brand-new)
  //   tier 2: posted in the last 24 hours  (today)
  //   tier 1: posted in the last 7 days    (this week)
  //   tier 0: everything else              (still surfaced, up to ~1 month+)
  //
  // Using a single CASE expression lets PostgreSQL order by it as the
  // primary key and the index on postedAt keeps this cheap.
  const freshnessTierExpr = `
    CASE
      WHEN COALESCE(ej."postedAt", ej."createdAt") > NOW() - INTERVAL '1 hour'  THEN 3
      WHEN COALESCE(ej."postedAt", ej."createdAt") > NOW() - INTERVAL '24 hours' THEN 2
      WHEN COALESCE(ej."postedAt", ej."createdAt") > NOW() - INTERVAL '7 days'   THEN 1
      ELSE 0
    END
  `.trim();

  // ORDER BY differs by sort mode:
  //   recommended → freshness tier first (last hour → last day → last week →
  //                 older), then match × recency within each tier
  //   match       → match score, recency tiebreak
  //   recent      → recency, match tiebreak
  let orderExpr;
  if (sortMode === 'match') {
    orderExpr = `${scoreExpr} DESC, ${recencyOrderExpr}`;
  } else if (sortMode === 'recent') {
    orderExpr = `${recencyOrderExpr}, ${scoreExpr} DESC`;
  } else {
    // recommended (default): tier by freshness, then by match × recency.
    // Older jobs (1 month+) still surface in the bottom tier so the
    // candidate isn't starved of results when fresh listings are thin.
    orderExpr = `${freshnessTierExpr} DESC, ${rankScoreExpr} DESC, ${recencyOrderExpr}`;
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
  const needsAnn = sortMode !== 'recent';
  // POOL = max(500, (limit + offset) * 3), capped at 3000. Allows ~25
  // pages of 20 results; cap keeps the worst case bounded.
  const annPoolExpr = `LEAST(GREATEST(500, ($2::int + $3::int) * 3), 3000)`;

  const query = needsAnn ? `
    WITH ann_candidates AS (
      SELECT ej.id
      FROM "ExternalJobs" ej
      WHERE ${whereClause}
      ORDER BY ej.embedding <=> $1::vector
      LIMIT ${annPoolExpr}
    )
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

  // When the ANN CTE is in play, bump hnsw.ef_search above the default 40.
  // Larger ef_search → wider HNSW traversal → better recall when restrictive
  // WHERE filters (locationType, salary, skills, etc.) shrink the candidate
  // pool. 200 is a sweet spot: recall stays > 99% on this corpus while the
  // index probe is still single-digit ms.
  //
  // SET LOCAL only applies inside an explicit transaction. Outside one it
  // would be a no-op at best and a session-leaking config change at worst.
  // We wrap the SELECT in a transaction so the setting is scoped correctly
  // and rolled back automatically when the read completes.
  try {
    const t0 = Date.now();
    const runListQuery = needsAnn
      ? sequelize.transaction(async (t) => {
          await sequelize.query(`SET LOCAL hnsw.ef_search = 200`, { transaction: t });
          return sequelize.query(query, {
            bind: binds,
            type: sequelize.constructor.QueryTypes.SELECT,
            transaction: t,
          });
        })
      : sequelize.query(query, {
          bind: binds,
          type: sequelize.constructor.QueryTypes.SELECT,
        });

    // Count cache — filter-signature keyed, user-independent. See the
    // module-level comment on jobsCountCache for the rationale; in short,
    // the count is the same for every user with the same filter set, and
    // recomputing it on every request is the dominant cost here.
    const countCacheKey = `${countWhereClause}|${JSON.stringify(filterBinds)}`;
    const cachedCount = jobsCountCache.get(countCacheKey);
    const countFreshEnough = cachedCount && cachedCount.expiresAt > Date.now();

    const runCountQuery = countFreshEnough
      ? Promise.resolve([{ total: cachedCount.total }])
      : sequelize.query(countQuery, {
          bind: filterBinds,
          type: sequelize.constructor.QueryTypes.SELECT,
        });

    const [results, countResult] = await Promise.all([runListQuery, runCountQuery]);
    const listMs = Date.now() - t0;

    const total = parseInt(countResult[0]?.total) || 0;

    if (!countFreshEnough) {
      // Cap entries to keep memory bounded; FIFO eviction is fine since
      // hot filter combos are revisited continuously and stay warm.
      if (jobsCountCache.size >= JOBS_COUNT_CACHE_MAX_ENTRIES) {
        const oldest = jobsCountCache.keys().next().value;
        if (oldest !== undefined) jobsCountCache.delete(oldest);
      }
      jobsCountCache.set(countCacheKey, {
        total,
        expiresAt: Date.now() + JOBS_COUNT_CACHE_TTL_MS,
      });
    }

    // Log when a request gets visibly slow so we can spot regressions in
    // prod logs. 1500ms is generous (typical good runs are 30-150ms) but
    // catches the multi-second outliers the user actually feels.
    if (listMs > 1500) {
      console.warn(
        `[JobEmbedding] slow searchSimilarJobs: ${listMs}ms ` +
        `(needsAnn=${needsAnn}, countCached=${countFreshEnough}, ` +
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
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS
};
