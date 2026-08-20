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
const { buildJobSearchTsquery } = require('../utils/searchQuery');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 512;
const MAX_BATCH_SIZE = 64; // Inputs per OpenAI embed call. Kept well under
// the API's hard limit to shrink the request body — large bodies correlate
// with undici "Premature close" drops under load. _embedTextsWithSplit below
// salvages the rest of a batch if a call still fails.

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
// 6 hours, not 15 minutes. The mapping from query text to embedding is
// deterministic and can never go stale — the only reason to expire it at all is
// memory. A short TTL meant that every 15 minutes the first user to search a
// given term (or the first to load the jobs page, since the profile-derived
// roleHint goes through here too) paid a live OpenAI round trip before their
// results could be ranked.
const SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
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

// Deliberately a no-op now.
//
// This was called from every sync that changed anything. With hundreds of
// boards a sync is almost always in flight, so the count cache was cleared
// continuously and effectively never served a request — the COUNT it exists to
// avoid was being recomputed on every cache miss, which on the production
// corpus is the dominant cost of a filtered listing.
//
// The 60s TTL already bounds staleness, and a total that is up to a minute out
// of date is invisible in a "N jobs" label. Kept as an exported function so the
// sync call sites do not need to change and can still force a clear if a future
// caller genuinely needs one.
function invalidateJobsCountCache({ force = false } = {}) {
  if (force) jobsCountCache.clear();
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
    // title/headline ride along so GET /external-jobs can derive the role hint
    // without the browser first fetching the profile itself — that round-trip
    // used to gate the whole jobs list request. Two small text columns on a row
    // we were already reading.
    attributes: ['id', 'skills', 'openaiEmbedding', 'title', 'headline', 'location'],
  });
  if (!row) {
    return null;
  }
  const value = {
    profileId: row.id,
    profileEmbedding: _parseEmbeddingValue(row.openaiEmbedding),
    skillSet: _buildSkillSet(row.skills),
    // Raw, unreduced. Callers apply deriveRoleQuery themselves so this cache
    // doesn't have to be invalidated if that reduction ever changes.
    roleTitle: row.title || row.headline || null,
    profileLocation: row.location || null,
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
// Is this a connection/transport-level failure (vs an API-level error like a
// 400 on a poison input)? Splitting the batch can isolate a poison input, but
// it can NOT help a dropped socket — so for connection errors we must bail out
// of the whole group instead of fanning one failure into N retried sub-calls.
function _isConnectionError(error) {
  const name = error?.name || '';
  const msg = error?.message || '';
  return (
    name === 'APIConnectionError' ||
    name === 'APIConnectionTimeoutError' ||
    /premature close|invalid response body|terminated|econnreset|etimedout|socket hang up|fetch failed|connection error|network/i.test(msg)
  );
}

// Embed an array of texts, returning one embedding (or null) per input in
// order. On failure of a multi-item call the batch is split in half and each
// half retried independently — so one poison input no longer wipes the entire
// batch. Recurses down to single items.
//
// EXCEPTION: a connection-level failure (undici "Premature close" / timeout)
// is NOT a poison input — the socket to OpenAI is the problem, and splitting
// just multiplies one failure into ~2N retried create() calls (a 50-item
// batch → ~99 calls × SDK retries = a log flood + socket/CPU drain that, on
// our single-worker box, competes with a Postgres that may itself be in
// recovery). For those we throw a tagged error so the caller aborts the whole
// batch and its circuit breaker backs off.
async function _embedTextsWithSplit(client, texts) {
  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS
    });
    return texts.map((_, j) => response.data?.[j]?.embedding || null);
  } catch (error) {
    if (_isConnectionError(error)) {
      const e = new Error(error.message);
      e.isConnectionError = true;
      throw e;
    }
    if (texts.length === 1) {
      console.error(`[JobEmbedding] embed failed (single input):`, error.message);
      return [null];
    }
    const mid = Math.ceil(texts.length / 2);
    const left = await _embedTextsWithSplit(client, texts.slice(0, mid));
    await new Promise(r => setTimeout(r, 150));
    const right = await _embedTextsWithSplit(client, texts.slice(mid));
    return [...left, ...right];
  }
}

async function generateBatchJobEmbeddings(jobs) {
  let success = 0;
  let failed = 0;
  let connectionError = false;
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

    let embeddings;
    try {
      embeddings = await _embedTextsWithSplit(client, texts);
    } catch (error) {
      if (error.isConnectionError) {
        // OpenAI is unreachable — stop now rather than grinding through every
        // remaining batch (and every job's SDK retries) against a dead socket.
        // Count the rest as failed and let the caller's circuit breaker back off.
        connectionError = true;
        failed += jobs.length - i - (batch.length - texts.length);
        break;
      }
      throw error;
    }
    const updates = [];
    for (let j = 0; j < validJobs.length; j++) {
      const embedding = embeddings[j];
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

    // Rate limit: small delay between batches
    if (i + MAX_BATCH_SIZE < jobs.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return { success, failed, connectionError };
}

// Self-healing backfill: embed a small batch of active jobs that have no
// embedding yet (newest first — those are what users actually see). New jobs
// are embedded inline at ingest, but that call can drop and leave them
// unembedded, which makes them invisible to semantic RANKING (they still
// appear via the recency path after the membership fix, just unranked).
// Scheduled cron is off in this topology, so the API process sweeps these on
// an interval (see server.js). Bounded + single-flight so it never piles
// load on the DB.
//
// Circuit breaker: the same NULL-embedding rows are re-picked every tick, so
// if OpenAI is down (undici "Premature close") or Postgres is in recovery,
// the naive loop hammers a dead dependency every interval forever — exactly
// the log flood / socket drain seen in prod. When a tick makes no progress
// because the dependency is unreachable, we skip subsequent ticks with
// exponential backoff (5m → 1h cap) and auto-resume the moment it recovers.
// Returns { success, failed, picked }.
let _embedBackfillInFlight = false;
let _embedBackfillSkipUntil = 0;          // epoch ms; skip ticks until this
let _embedBackfillConsecutiveOutages = 0; // drives exponential backoff
const EMBED_OUTAGE_BASE_BACKOFF_MS = 5 * 60 * 1000;  // 5 min
const EMBED_OUTAGE_MAX_BACKOFF_MS = 60 * 60 * 1000;  // 1 hr
const EMBED_DB_BACKOFF_MS = 60 * 1000;               // 1 min while DB recovers

function _embedBackfillBackOff(reason) {
  _embedBackfillConsecutiveOutages++;
  const backoff = Math.min(
    EMBED_OUTAGE_BASE_BACKOFF_MS * 2 ** (_embedBackfillConsecutiveOutages - 1),
    EMBED_OUTAGE_MAX_BACKOFF_MS
  );
  _embedBackfillSkipUntil = Date.now() + backoff;
  console.warn(`[EmbedBackfill] ${reason} — backing off ${Math.round(backoff / 60000)}m`);
}

async function backfillMissingJobEmbeddings({ limit = 50 } = {}) {
  if (!process.env.OPENAI_API_KEY) return { success: 0, failed: 0, picked: 0, skipped: 'no-key' };
  if (_embedBackfillInFlight) return { success: 0, failed: 0, picked: 0, skipped: 'in-flight' };
  if (Date.now() < _embedBackfillSkipUntil) return { success: 0, failed: 0, picked: 0, skipped: 'backoff' };
  _embedBackfillInFlight = true;
  try {
    let rows;
    try {
      rows = await sequelize.query(
        `SELECT id, title, company, department, location, "locationType",
                "experienceLevel", skills, requirements, description
         FROM "ExternalJobs"
         WHERE "isActive" = true AND embedding IS NULL
         ORDER BY "effectivePostedAt" DESC
         LIMIT $1`,
        { bind: [limit], type: sequelize.constructor.QueryTypes.SELECT }
      );
    } catch (dbErr) {
      // DB unreachable / in recovery mode — back off briefly so we stop
      // piling reconnection attempts onto a Postgres that is trying to
      // come back up. Short, fixed backoff (not exponential) since the DB
      // typically recovers in a minute or two.
      _embedBackfillSkipUntil = Date.now() + EMBED_DB_BACKOFF_MS;
      return { success: 0, failed: 0, picked: 0, skipped: 'db-error', error: dbErr.message };
    }
    if (!rows.length) { _embedBackfillConsecutiveOutages = 0; return { success: 0, failed: 0, picked: 0 }; }
    const { success, failed, connectionError } = await generateBatchJobEmbeddings(rows);
    if (success > 0) {
      _embedBackfillConsecutiveOutages = 0;   // progress — reset the breaker
    } else if (connectionError) {
      _embedBackfillBackOff(`OpenAI unreachable (${failed} failed)`);
    }
    return { success, failed, picked: rows.length };
  } finally {
    _embedBackfillInFlight = false;
  }
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
/**
 * Backfill missing Profile.openaiEmbedding rows.
 *
 * Without a profile vector a signed-in candidate cannot take the semantic
 * ranking path at all — GET /external-jobs drops them to the keyword fallback,
 * which pools by recency and is much weaker at telling one engineering role
 * from another. Measured on this database, only 9 of 70 profiles had an
 * embedding, so the good path was serving a small minority of users while
 * everyone else got the degraded one and no signal that anything was wrong.
 *
 * Embeddings were only ever generated lazily: on profile save, or opportunistically
 * when a legacy user happened to load the jobs page. Anyone who built a profile
 * before that existed, or whose generation call failed once, stayed without one
 * permanently. This sweeps them the same way job embeddings are swept — small
 * batches, single-flight, gentle on the OpenAI rate limit.
 *
 * @param {Object} opts
 * @param {number} opts.limit - max profiles per run (default 25)
 * @returns {Promise<{success:number, failed:number, picked:number, skipped?:string}>}
 */
let _profileBackfillInFlight = false;
async function backfillMissingProfileEmbeddings({ limit = 25 } = {}) {
  if (!process.env.OPENAI_API_KEY) return { success: 0, failed: 0, picked: 0, skipped: 'no-key' };
  if (_profileBackfillInFlight) return { success: 0, failed: 0, picked: 0, skipped: 'in-flight' };
  _profileBackfillInFlight = true;
  try {
    const { Profile } = require('../models');
    const rows = await Profile.findAll({
      where: { openaiEmbedding: null },
      // Newest first: an active candidate benefits from ranking today, whereas
      // a long-dormant profile can wait for a later tick.
      order: [['updatedAt', 'DESC']],
      limit,
    });
    if (!rows.length) return { success: 0, failed: 0, picked: 0 };

    let success = 0;
    let failed = 0;
    for (const profile of rows) {
      try {
        const result = await regenerateProfileOpenAIEmbedding(profile);
        if (result) {
          success++;
          invalidateProfileForJobsCache(profile.userId);
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        console.warn(`[ProfileEmbedBackfill] ${profile.id} failed:`, err.message);
      }
    }
    return { success, failed, picked: rows.length };
  } finally {
    _profileBackfillInFlight = false;
  }
}

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
/**
 * Read-only cache probe. Lets a request decide whether the embedding is
 * available RIGHT NOW without ever blocking on OpenAI — see warmSearchQueryEmbedding.
 */
function getCachedSearchEmbedding(searchText) {
  if (!searchText || searchText.trim().length < 2) return null;
  const entry = searchEmbeddingCache.get(`search:${searchText.trim().toLowerCase()}`);
  return entry && entry.expiresAt > Date.now() ? entry.embedding : null;
}

/**
 * Populate the cache in the background. Never awaited by a request.
 *
 * Ranking quality degrades gracefully without a query embedding — the profile
 * vector still ranks, and a typed search still applies its full-text filter —
 * so blocking a page render on a third-party API call to get a slightly better
 * ORDER BY is a bad trade. The first request for an uncached term renders
 * immediately with profile-only ranking and warms the cache for everyone after.
 */
function warmSearchQueryEmbedding(searchText) {
  if (!searchText || getCachedSearchEmbedding(searchText)) return;
  generateSearchQueryEmbedding(searchText).catch(() => { /* cache stays cold; retried next request */ });
}

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
  const { limit = 100, offset = 0, locationType = null, location = null, search = null, searchEmbedding = null, rankText = null, datePosted = null, defaultMaxAgeDays = 0, company = null, experienceLevel = null, employmentType = null, department = null, skills = null, startup = false, salaryMin = null, salaryMax = null, sortMode = 'recommended' } = options;
  const { NON_STARTUP_COMPANIES, NON_STARTUP_FUNDING_STAGES } = require('../utils/startupClassifier');

  const conditions = [
    `ej."isActive" = true`
  ];
  // NOTE: we deliberately do NOT require `ej.embedding IS NOT NULL` here.
  // Freshly-ingested jobs are embedded asynchronously, so a hard NOT-NULL
  // filter made every just-posted job invisible to logged-in users (the
  // semantic path) while the keyword path still showed them — the cause of
  // "why does it only show 4 jobs". Unembedded rows are kept in the candidate
  // set (their score COALESCEs to 0, see scoreExpr) and are still surfaced by
  // the recency ordering / recency UNION arm. The HNSW cosine arm below keeps
  // its own local `embedding IS NOT NULL` so the index stays efficient.
  // $1 = profileEmbedding, $2 = limit, $3 = offset, optional $4+ for filters
  const binds = [JSON.stringify(profileEmbedding), limit, offset];
  let bindIndex = 4;

  // Role/query text is scored LEXICALLY against the title vector rather than by
  // embedding it. Measured on this corpus for "Frontend Engineer":
  //
  //                        cosine        ts_rank_cd on title
  //     frontend roles      0.543          0.899  (22/22 matched)
  //     generic software    0.465          0.012  ( 6/330)
  //     solutions engineer  0.453          0.000  ( 0/57)
  //     sales               0.464          0.000  ( 0/184)
  //
  // Cosine separates a frontend role from a SALES role by 0.08; the lexical
  // rank separates them completely. It is also free, needs no third-party call
  // on the request path, and is served by the existing searchTsvAB GIN index.
  // buildJobSearchTsquery expands synonyms (frontend | react | angular | vue |
  // ui) & (engineer | developer | programmer), so this is not naive substring
  // matching.
  //
  // Crucially it is a RANKING term, not a filter — off-target roles score 0 and
  // sink, but stay in the result set, which is what went wrong when the role
  // was applied as a hard WHERE clause.
  let rankTsqBindIdx = null;
  const rankTsq = rankText ? buildJobSearchTsquery(rankText) : null;
  if (rankTsq) {
    rankTsqBindIdx = bindIndex;
    binds.push(rankTsq);
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
      conditions.push(`ej."effectivePostedAt" >= $${bindIndex}`);
      binds.push(dateMap[datePosted].toISOString());
      bindIndex++;
    }
  } else if (defaultMaxAgeDays > 0) {
    // No explicit datePosted → apply the default freshness window so semantic
    // results match the recency/keyword paths and don't surface year-old
    // "active" postings. Mirrors JOBS_DEFAULT_MAX_AGE_DAYS in routes/externalJobs.
    const cutoff = new Date(Date.now() - defaultMaxAgeDays * 24 * 60 * 60 * 1000);
    conditions.push(`ej."effectivePostedAt" >= $${bindIndex}`);
    binds.push(cutoff.toISOString());
    bindIndex++;
  }

  if (search) {
    // Hard text filter on the typed query. This is ALWAYS applied when a
    // search term is present — it is independent of whether we have a query
    // embedding (the embedding only affects RANKING via scoreExpr, never the
    // candidate set).
    //
    // We require EVERY token to hit title (A) or company/department (B) via
    // the searchTsvAB STORED generated tsvector. Crucially, searchTsvAB does
    // NOT include the description — matching the description (weight C) is
    // what made a "Frontend Engineer" search return Solutions Managers,
    // Backend/Embedded roles, etc. that merely *mention* "frontend" and
    // "engineer" somewhere in their job description. Title/company/dept-only
    // matching keeps the candidate set genuinely on-topic.
    //
    // AND semantics with prefix-stemming (`token:*`) preserves useful
    // looseness — "Frontend Engineer" still matches "Frontend Engineering",
    // "Frontend Software Engineer", etc. — while requiring all concepts to be
    // present. The frontend trims seniority prefixes ("Senior Frontend
    // Engineer" → "Frontend Engineer") before seeding the search box, so AND
    // does not over-restrict common queries. A single GIN-indexable `@@`
    // enforces this with no per-row ts_rank_cd (which on common terms timed
    // the query out). See ensureExternalJobPerfSchema.js.
    //
    // Tokens are sanitized to [a-z0-9]+ so user input can't break to_tsquery
    // syntax (quotes / colons / parens are stripped at the JS layer; the
    // value is also passed via a bind, not interpolated).
    //
    // buildJobSearchTsquery additionally expands role-spelling/synonym concepts
    // — "frontend" ⇄ "front end" ⇄ "front-end", "engineer" ⇄ "developer" — so a
    // "Frontend Engineer" search also matches "Front End Engineer" /
    // "Frontend Developer" titles that tokenize differently. Distinct concepts
    // are still AND-ed, so recall widens without drifting to unrelated roles.
    const tsqExpr = buildJobSearchTsquery(search);

    if (tsqExpr) {
      conditions.push(`ej."searchTsvAB" @@ to_tsquery('english', $${bindIndex})`);
      binds.push(tsqExpr);
      bindIndex++;
    }
    // If sanitization stripped everything (e.g. a pure-symbol query), fall
    // through with no text filter: when we have an embedding cosine carries
    // the intent; otherwise the other filters (location/level/…) still apply.
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

  // Startup filter (mirrors routes/externalJobs.js — keep in sync). Reads the
  // denormalized ExternalJobs.isStartup boolean (set at ingest from the source
  // board's ATSBoards.isStartup), OR source = 'hn_hiring'. We deliberately do
  // NOT join ExternalJobs → ATSBoards: their source/platform are different enum
  // types and casting to compare them defeats the (platform, boardToken) index,
  // which timed the COUNT out under sync load. Both arms here are indexed.
  //
  // Defense-in-depth, unconditionally:
  //   - company name is NOT on the curated non-startup deny-list.
  //   - the linked Company's funding stage is NOT late/IPO/Series D+.
  if (options.hideStale) {
    // Mirror of the keyword path's hideStale filter — the two must agree or the
    // same request would return different sets depending on whether the user
    // happened to have a profile embedding.
    conditions.push(`COALESCE(ej."ghostScore", 0) < ${parseInt(process.env.GHOST_THRESHOLD || '50', 10)}`);
  }

  if (startup) {
    conditions.push(`(ej."source" = 'hn_hiring' OR ej."isStartup" = true)`);
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
  const filterBindStartIndex = rankTsq ? 5 : 4; // $4, or $5 when a rank tsquery is bound
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
  // The badge percentage the UI shows. Declared AFTER the normalisation block
  // below sets up REL_FLOOR/REL_CEIL — see `scoreExpr` further down.
  // 'recommended' ordering goal: a candidate (e.g. a SF Frontend dev) opening
  // the jobs page should see the LATEST posted RELEVANT jobs on top — i.e.
  // strict newest-first ordering AMONG the jobs that actually match their
  // profile, with off-target roles (recruiter, design, sales) kept out of the
  // top. Uses COALESCE(postedAt, createdAt) because Greenhouse jobs store
  // postedAt = NULL (see normalizeGreenhouseJob comment).
  const recencyOrderExpr = `ej."effectivePostedAt" DESC NULLS LAST`;

  // ── Relevance normalisation ────────────────────────────────────────────────
  // Raw cosine similarity is a TERRIBLE ranking signal on its own here because
  // its dynamic range is tiny. Measured against this corpus for the query
  // "Frontend Engineer" (text-embedding-3-small, 512d):
  //
  //     frontend roles        avg 0.543   (0.442 - 0.635)
  //     generic software eng  avg 0.465
  //     sales roles           avg 0.464
  //     solutions engineer    avg 0.453
  //
  // A frontend role scores barely 0.08 above a SALES role. So multiplying raw
  // cosine by a freshness factor that swings 1.0 -> 0.5 let recency dominate
  // completely: a day-old "Senior Solutions Engineer" (0.483 x 1.0 = 0.483)
  // outranked the single best frontend match in the corpus (0.635 x 0.5 =
  // 0.318). That is exactly the "unrelated jobs on top" complaint.
  //
  // Fix: stretch the useful cosine band onto 0..1 first, so a real difference
  // in fit becomes a real difference in score, then combine ADDITIVELY with a
  // modest freshness term. Additive keeps freshness from ever erasing a large
  // relevance gap — it can only reorder jobs of comparable fit.
  //
  // The band is model- and corpus-dependent, so it is tunable without a deploy.
  const REL_FLOOR = parseFloat(process.env.JOBS_REL_COS_FLOOR || '0.43');
  const REL_CEIL = parseFloat(process.env.JOBS_REL_COS_CEIL || '0.63');
  const REL_SPAN = Math.max(0.01, REL_CEIL - REL_FLOOR);
  const normalizeRel = (cos) =>
    `LEAST(1.0, GREATEST(0.0, ((${cos}) - ${REL_FLOOR}) / ${REL_SPAN}))`;

  // Blended similarity: search/roleHint text dominates, profile provides the
  // background signal. NULL when the row has no embedding yet.
  const profileCosExpr = `(1 - (ej.embedding <=> $1::vector))`;
  // Normalised lexical title match, 0..1. ts_rank_cd for a solid title hit sits
  // around 0.9, so 0.5 is a generous saturation point.
  const lexNormExpr = rankTsqBindIdx
    ? `LEAST(1.0, ts_rank_cd(ej."searchTsvAB", to_tsquery('english', $${rankTsqBindIdx})) / 0.5)`
    : null;

  // Profile fit carries the semantic load — it recognises a relevant job whose
  // title lacks the keyword — but the lexical term decides the top of the list,
  // because it is the signal that actually discriminates. The profile embedding
  // is read from the row we already store, so unlike the old query embedding it
  // costs no API call at request time.
  const vecRelExpr = normalizeRel(profileCosExpr);

  // Un-embedded rows: RENORMALIZE onto the lexical term rather than blending in
  // a constant.
  //
  // Jobs are embedded asynchronously after ingest, so the newest listings are
  // exactly the ones without a vector — measured on this corpus, only ~12% of
  // the rows in the recency-bounded pool had one. Substituting a fixed neutral
  // value (previously 0.15) for the missing cosine made "has an embedding"
  // worth more than actual fit: an off-target job WITH a vector scored
  // 0.4*0.30 = 0.120 against an off-target job WITHOUT one at 0.4*0.15 = 0.060,
  // and that 0.06 gap outweighs roughly a week of freshness. The result was a
  // feed whose ordering tracked the backfill queue instead of relevance —
  // dates arriving 4d, 2d, 5d, 2h with no visible reason.
  //
  // Renormalizing removes the phantom signal entirely: when there is no cosine,
  // the lexical rank is simply scored on its own scale, so an unembedded job is
  // judged on the evidence we actually have about it and competes on equal
  // terms. Rows with neither signal fall to 0 and are ordered by freshness,
  // which is the honest answer for "we know nothing about this yet".
  const orderingRelevanceExpr = lexNormExpr
    ? `CASE WHEN ej.embedding IS NULL
             THEN ${lexNormExpr}
             ELSE (0.6 * ${lexNormExpr} + 0.4 * ${vecRelExpr}) END`
    : `COALESCE(${vecRelExpr}, 0.0)`;

  // Freshness, normalised to 0..1 over the retention horizon rather than used
  // as a multiplier. Weighted well below relevance so it breaks ties among
  // comparable matches instead of overriding fit.
  //
  // The horizon MUST match the window the feed actually shows. It was pinned at
  // 30 days while the default window was 60, so everything older than 30 days
  // saturated at zero freshness and tied — age stopped discriminating over the
  // whole back half of the visible corpus, which is how a 59-day-old posting
  // led the list. Both now derive from JOBS_MAX_AGE_DAYS.
  const FRESH_HORIZON_DAYS = Math.max(
    1,
    parseInt(process.env.JOBS_DEFAULT_MAX_AGE_DAYS || process.env.JOBS_MAX_AGE_DAYS || '30', 10) || 30
  );
  const freshnessNormExpr = `
    GREATEST(0.0, 1.0 - LEAST(
      EXTRACT(EPOCH FROM (NOW() - ej."effectivePostedAt")) / 86400.0,
      ${FRESH_HORIZON_DAYS}.0
    ) / ${FRESH_HORIZON_DAYS}.0)`;
  const REL_WEIGHT = parseFloat(process.env.JOBS_RANK_REL_WEIGHT || '0.8');
  const FRESH_WEIGHT = Math.max(0, 1 - REL_WEIGHT);
  // Ghost-job demotion. A listing nobody is actually hiring for is worse than a
  // merely mediocre match — it wastes an application. Subtracted rather than
  // used as a filter: a slow-to-fill senior role scores like a ghost, and we
  // cannot tell the difference from outside, so a suspected ghost sinks but
  // stays reachable. At the maximum score this costs 0.35, enough to push a
  // listing well down without ever erasing a strong match entirely.
  const GHOST_PENALTY_WEIGHT = parseFloat(process.env.JOBS_GHOST_PENALTY || '0.35');
  const ghostPenaltyExpr = `(${GHOST_PENALTY_WEIGHT} * (COALESCE(ej."ghostScore", 0) / 100.0))`;
  // Consumes ej._rel, precomputed once per row by the `scored` CTE below rather
  // than re-derived everywhere it appears. The relevance expression contains a
  // ts_rank_cd and a 512-dimension cosine, and it previously appeared in both
  // the SELECT list and the ORDER BY — so PostgreSQL evaluated it roughly four
  // times per candidate row. Measured on the pool this query actually uses,
  // computing it once cut the scoring stage from 293ms to 71ms.
  const recommendedRankExpr =
    `(${REL_WEIGHT} * ej._rel + ${FRESH_WEIGHT} * (${freshnessNormExpr}) - ${ghostPenaltyExpr})`;

  // ── Relevance BANDING for the default ordering ─────────────────────────────
  // The continuous rank above is a good ordering and a bad reading experience.
  // Freshness contributes at most FRESH_WEIGHT (0.2) across the entire horizon,
  // so any relevance difference above ~0.04 outranks a full month of recency and
  // dates interleave everywhere: users saw 4d, then 2d, then 5d, then 2h and
  // reasonably read it as broken sorting. The page's own comment already
  // described the intended behaviour as "relevance band + latest-posted within
  // the band" — that banding was simply never implemented.
  //
  // Quantising relevance into fixed-width bands restores it. Fit still decides
  // which band a job lands in, so a strong match never sinks below a weak one;
  // within a band — jobs that are, as far as we can tell, comparably good — the
  // newest is on top and the dates descend monotonically as the user scans.
  //
  // Band width is the one tuning knob: too wide and relevance stops mattering,
  // too narrow and the interleaving comes back. 0.1 gives ~10 bands over the
  // normalised range, which is coarser than the noise floor of the underlying
  // cosine (whose useful spread is only ~0.2 raw) and finer than the gap between
  // a real role match and a generic one.
  const BAND_WIDTH = parseFloat(process.env.JOBS_RANK_BAND_WIDTH || '0.1');
  const bandExpr = BAND_WIDTH > 0
    ? `FLOOR(GREATEST(0.0, ${REL_WEIGHT} * ej._rel - ${ghostPenaltyExpr}) / ${BAND_WIDTH})`
    : null;
  // Materialised as `_band` in the scored CTE so the ORDER BY and the company
  // interleave below can both reference it without recomputing the cosine.
  const bandedRankExpr = bandExpr ? 'ej._band' : null;

  // Badge percentage is now derived from `_rel` in the outer SELECT rather than
  // being its own expression — see SELECT_COLS below.
  //
  // It used to be a SECOND, subtly different formula, and the two disagreed
  // exactly where it was most visible. The badge substituted 0 for a missing
  // cosine while the ordering substituted something else, so an un-embedded job
  // with a perfect title match ranked as 1.0 but displayed 60%, and a Stripe
  // "React Native Engineer" displaying 100% sat three rows BELOW it. A user
  // reading a match percentage next to a position has every right to expect
  // them to be the same judgement; deriving one from the other makes that
  // structural instead of aspirational, and evaluates the expensive expression
  // (a ts_rank_cd plus a 512-dimension cosine) once per row instead of twice.

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
  // 'recommended' uses a RECENCY-BOUNDED pool instead of an ANN pool. The
  // mode's promise is "the freshest jobs that fit you", so the candidate set
  // is defined by freshness (an index-ordered LIMIT on the partial
  // (isActive, recency) index) and relevance decides the ORDER within it.
  //
  // This is both more correct and cheaper than the previous ANN+UNION pool:
  //   - Correct: every recent matching job is a candidate, so a brand-new
  //     posting can never be locked out by a rising cosine bar as the corpus
  //     grows (the failure mode that made the feed look stale).
  //   - Cheap: cosine is computed on at most RECOMMENDED_POOL rows instead of
  //     being ORDER BY-driven across the corpus, and it needs no HNSW probe.
  //     That is what makes it affordable to rank on relevance again after the
  //     earlier timeout-driven retreat to pure recency.
  const isRecommended = sortMode === 'recommended';
  const needsAnn = sortMode === 'match' && total > SMALL_SET_THRESHOLD;
  // POOL = max(500, (limit + offset) * 3), capped at 3000. Allows ~25
  // pages of 20 results; cap keeps the worst case bounded.
  const annPoolExpr = `LEAST(GREATEST(500, ($2::int + $3::int) * 3), 3000)`;
  // Recommended pool: generous enough that deep pagination still has ranked
  // content, bounded so the per-row cosine stays milliseconds.
  const RECOMMENDED_POOL_MAX = 4000;
  const recommendedPoolExpr = `LEAST(GREATEST(2000, ($2::int + $3::int) * 5), ${RECOMMENDED_POOL_MAX})`;

  // A RELEVANCE ARM on the recency pool.
  //
  // The pool is "the newest N matching jobs", which quietly assumes ingest is
  // spread evenly across boards. It is not. Greenhouse — three quarters of the
  // corpus — exposes no first-published date, so we store its `updated_at`, and
  // any sync that touches a requisition re-stamps it as new. One large board
  // therefore lands thousands of simultaneously-"fresh" rows. Measured here,
  // the newest 2,000 rows came from just EIGHT companies.
  //
  // That is upstream of every relevance complaint about this feed: a frontend
  // engineer cannot be shown a frontend job if the eligible set is eight
  // employers deep and none of them posted one. The end-of-query diversity cap
  // can only choose well among what the pool already contains.
  //
  // So when we have a role/query to match on, the pool gets a second arm: the
  // newest jobs whose TITLE actually matches, regardless of where they sit in
  // the global recency ordering. A role-matching posting anywhere in the
  // retention window is now always a candidate.
  //
  // Preferred over a per-company ceiling on the recency arm, which was the
  // other obvious fix and measurably worse: capping each company to its newest
  // K rows excluded a big board's genuinely relevant jobs whenever they weren't
  // among its most recently re-stamped, and cost ~800ms on the window function.
  // This arm is a GIN-indexed `@@` over the same tsvector the search filter
  // already uses, so it is cheap and it targets the actual failure.
  const lexPoolExpr = `LEAST(GREATEST(500, ($2::int + $3::int) * 3), 2000)`;

  const candidateCte = isRecommended
    ? (rankTsqBindIdx
      ? `
    WITH ann_candidates AS (
      (
        SELECT ej.id
        FROM "ExternalJobs" ej
        WHERE ${whereClause}
        ORDER BY ej."effectivePostedAt" DESC NULLS LAST, ej.id DESC
        LIMIT ${recommendedPoolExpr}
      )
      UNION
      (
        SELECT ej.id
        FROM "ExternalJobs" ej
        WHERE ${whereClause}
          AND ej."searchTsvAB" @@ to_tsquery('english', $${rankTsqBindIdx})
        ORDER BY ej."effectivePostedAt" DESC NULLS LAST, ej.id DESC
        LIMIT ${lexPoolExpr}
      )
    )`
      : `
    WITH ann_candidates AS (
      SELECT ej.id
      FROM "ExternalJobs" ej
      WHERE ${whereClause}
      ORDER BY ej."effectivePostedAt" DESC NULLS LAST, ej.id DESC
      LIMIT ${recommendedPoolExpr}
    )`)
    : `
    WITH ann_candidates AS (
      SELECT ej.id
      FROM "ExternalJobs" ej
      WHERE ${whereClause} AND ej.embedding IS NOT NULL
      ORDER BY ej.embedding <=> $1::vector, ej.id DESC
      LIMIT ${annPoolExpr}
    )`;

  const usesCandidateCte = isRecommended || needsAnn;

  // Pagination must not promise pages the pool can't fill. In 'recommended'
  // mode only the newest RECOMMENDED_POOL matching jobs are ranked, so
  // reporting the full corpus count would render page links that come back
  // empty. Cap the advertised total at the pool size for that mode only.
  const effectiveTotal = isRecommended
    ? Math.min(total, Math.min(Math.max(2000, (limit + offset) * 5), RECOMMENDED_POOL_MAX))
    : total;

  // Both paths route through a `scored` CTE that evaluates the expensive per-row
  // expressions EXACTLY ONCE.
  //
  // The relevance expression contains a ts_rank_cd and a 512-dimension cosine,
  // and it previously appeared in both the SELECT list and the ORDER BY — so
  // PostgreSQL evaluated it roughly four times per candidate row. On the pool
  // this query actually uses that measured 293ms; computing it once measured
  // 71ms. In production the same query stage was taking 13.9s, which is what a
  // user experienced as a 14-second jobs page.
  //
  // The CTE is aliased back to `ej` downstream so every expression built above
  // keeps referring to the same column names.
  const SELECT_COLS = `
      ej.id, ej."externalId", ej.source, ej."boardToken", ej.title, ej.company,
      ej.location, ej."locationType", ej."employmentType", ej."experienceLevel",
      ej.department, ej.description, ej.requirements, ej.skills,
      ej."salaryMin", ej."salaryMax", ej."salaryCurrency", ej."salaryPeriod",
      ej."applyUrl", ej."sourceUrl", ej."postedAt", ej."effectivePostedAt", ej."isActive",
      ej."lastFetchedAt", ej."createdAt", ej."updatedAt",
      ej."ghostScore", ej."ghostReasons", ej."companyId"`;

  const scoredSource = usesCandidateCte
    ? `FROM "ExternalJobs" ej JOIN ann_candidates ac ON ac.id = ej.id`
    : `FROM "ExternalJobs" ej WHERE ${whereClause}`;

  // ── Per-company interleave ─────────────────────────────────────────────────
  // Nothing limited how many results one employer could contribute, and the big
  // ATS boards are enormous relative to everyone else: in the measured San
  // Francisco pool Stripe had 62 postings, Neuralink 55, Databricks 46 — and a
  // real candidate's first page came back 11 of 20 Stripe. A feed that is mostly
  // one company is useless even when every row on it is individually relevant.
  //
  // This ROTATES employers instead of truncating them. Each job gets its
  // position within (relevance band, company), and the list is ordered by band,
  // then by that position, then by recency — so every company's best job in a
  // band comes before any company's second, and the page spreads across
  // employers without a single row being removed.
  //
  // Truncating was the obvious alternative and measurably wrong: capping at
  // three per company cut a browsable feed from 7,021 jobs to 24, because the
  // pool is only about eight distinct employers deep (Greenhouse re-stamps
  // `updated_at` on edit, so one board's whole catalogue looks freshly posted at
  // once). Diversity is a property the ORDERING should have, not a reason to
  // hide inventory the candidate could otherwise page through.
  //
  // Skipped when the user filtered BY company — they asked for that employer, so
  // rotating away from it would be perverse — and on the unbounded 'recent' path
  // where a window function would force materialising every matching row.
  const diversifyByCompany = usesCandidateCte && bandedRankExpr
    && process.env.JOBS_COMPANY_INTERLEAVE !== 'false' && !company;

  // Ceiling per company PER BAND, on top of the rotation.
  //
  // Rotation alone degenerates where one employer dominates a band: every
  // company's best job comes first, and then the largest board simply fills the
  // rest of the band — a measured page still came back 8 of 20 Stripe. This
  // bounds that tail.
  //
  // Deliberately generous, and per band rather than per query. A flat cap of 3
  // across the whole result was tried first and cut a browsable feed from 7,021
  // jobs to 24, because the pool is only about eight employers deep. At this
  // value only a company with more than N comparable jobs in a single band
  // loses anything, so inventory is essentially preserved while the first pages
  // stay mixed. Set JOBS_MAX_PER_COMPANY_PER_BAND=0 to keep rotation only.
  const COMPANY_BAND_CAP = parseInt(process.env.JOBS_MAX_PER_COMPANY_PER_BAND || '5', 10);

  // ORDER BY differs by sort mode:
  //   recommended → relevance band, then company rotation, then newest
  //   match       → match score, recency tiebreak
  //   recent      → recency, match tiebreak
  //
  // Built HERE, not beside the scoring expressions, because it depends on
  // `diversifyByCompany` and `usesCandidateCte`, which are decided further down.
  // Referencing them from the earlier position put a `const` in its temporal
  // dead zone: the semantic query threw a ReferenceError on every request and
  // the route quietly caught it and served the keyword fallback instead — a
  // silent, total loss of semantic ranking that looked like bad relevance
  // rather than an error.
  let orderExpr;
  if (sortMode === 'match') {
    orderExpr = `ej._rel DESC, ${recencyOrderExpr}`;
  } else if (sortMode === 'recent') {
    orderExpr = `${recencyOrderExpr}, ej._rel DESC`;
  } else if (bandedRankExpr) {
    orderExpr = diversifyByCompany
      ? `${bandedRankExpr} DESC, ej._company_slot ASC, ${recencyOrderExpr}`
      : `${bandedRankExpr} DESC, ${recencyOrderExpr}`;
  } else {
    // Banding disabled (JOBS_RANK_BAND_WIDTH=0) — fall back to the continuous
    // relevance × freshness score.
    orderExpr = `${recommendedRankExpr} DESC, ${recencyOrderExpr}`;
  }

  const query = `
    ${usesCandidateCte ? `${candidateCte},` : 'WITH'}
    scored AS (
      SELECT ${SELECT_COLS},
             ${orderingRelevanceExpr} AS _rel
      ${scoredSource}
    )${bandExpr ? `,
    banded AS (
      SELECT ej.*, ${bandExpr} AS _band FROM scored ej
    )` : ''}${diversifyByCompany ? `,
    diversified AS (
      SELECT ej.*,
             ROW_NUMBER() OVER (
               PARTITION BY ej._band, LOWER(COALESCE(ej.company, ''))
               ORDER BY ${recencyOrderExpr}, ej.id DESC
             ) AS _company_slot
      FROM banded ej
    )` : ''}
    SELECT ${SELECT_COLS},
      ROUND(GREATEST(0.0, LEAST(1.0, ej._rel)) * 100) as "relevanceScore",
      json_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug, 'domain', c.domain,
        'logoUrl', c."logoUrl", 'website', c.website, 'industry', c.industry,
        'employeeCount', c."employeeCount", 'employeeRange', c."employeeRange",
        'fundingStage', c."fundingStage", 'headquarters', c.headquarters,
        'linkedinUrl', c."linkedinUrl"
      ) as "companyInfo"
    FROM ${diversifyByCompany ? 'diversified' : (bandExpr ? 'banded' : 'scored')} ej
    LEFT JOIN "Companies" c ON ej."companyId" = c.id
    ${diversifyByCompany && COMPANY_BAND_CAP > 0 ? `WHERE ej._company_slot <= ${COMPANY_BAND_CAP}` : ''}
    ORDER BY ${orderExpr}, ej."createdAt" DESC, ej.id DESC
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
        `(mode=${sortMode}, needsAnn=${needsAnn}, total=${total}, ` +
        `filters=${filterBinds.length}, search=${!!search})`
      );
    }

    return {
      rows: results.map(({ _band, _company_slot, ...row }) => ({
        ...row,
        relevanceScore: Math.max(0, Math.min(100, parseInt(row.relevanceScore) || 0)),
        companyInfo: row.companyInfo?.id ? row.companyInfo : null
      })),
      total: effectiveTotal,
      // The unclamped corpus count, for callers that want to report "N jobs
      // available" separately from "N jobs ranked for you".
      matchingTotal: total
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
  getCachedSearchEmbedding,
  warmSearchQueryEmbedding,
  generateJobEmbedding,
  generateBatchJobEmbeddings,
  backfillMissingJobEmbeddings,
  generateProfileQueryEmbedding,
  generateSearchQueryEmbedding,
  regenerateProfileOpenAIEmbedding,
  backfillMissingProfileEmbeddings,
  searchSimilarJobs,
  invalidateJobsCountCache,
  loadProfileForJobsRanking,
  invalidateProfileForJobsCache,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS
};
