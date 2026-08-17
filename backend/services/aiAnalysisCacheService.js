/**
 * Read/write helper for AiAnalysisCache.
 *
 * The point of this cache is not merely speed — it is that a cache hit must
 * cost the user NOTHING. Re-opening a job previously re-ran the model and
 * decremented the AI quota for a report that could not have changed, so callers
 * are expected to consult this BEFORE the rate limiter, not after.
 *
 * Every function here is failure-tolerant: the cache is an optimisation, and a
 * problem reading or writing it must never stop a user getting their analysis.
 */

const crypto = require('crypto');
const { Op } = require('sequelize');

const DEFAULT_TTL_DAYS = parseInt(process.env.AI_ANALYSIS_CACHE_TTL_DAYS || '30', 10);

/**
 * Stable hash of the inputs that determine the answer.
 *
 * Only the parts of the profile the analysis actually reads are included, and
 * they are canonicalised (sorted keys, trimmed, lower-cased where
 * case-insensitive) so cosmetic differences — key order from a different client,
 * stray whitespace — don't produce a false miss and pay for the same answer
 * twice.
 */
function hashAnalysisInput(profileData = {}, jobDescription = '') {
  const skills = Array.isArray(profileData.skills)
    ? profileData.skills.map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean)
    : Object.values(profileData.skills || {}).flat().map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean);

  const canonical = JSON.stringify({
    title: String(profileData.title || '').trim().toLowerCase(),
    summary: String(profileData.summary || '').trim(),
    skills: skills.map((s) => String(s).trim().toLowerCase()).sort(),
    experience: (profileData.experience || []).map((e) => ({
      p: String(e.position || e.title || '').trim().toLowerCase(),
      c: String(e.company || '').trim().toLowerCase(),
      d: String(e.description || '').trim(),
      // Dates are part of the answer, not decoration: job-match derives
      // seniority fit from them, so a corrected start date has to miss the
      // cache rather than return the score computed from the old one.
      s: String(e.startDate || '').trim(),
      e: e.current ? 'current' : String(e.endDate || '').trim(),
    })),
    job: String(jobDescription || '').replace(/\s+/g, ' ').trim(),
  });

  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function buildKey(kind, userId, inputHash) {
  return `${kind}:${userId || 'anon'}:${inputHash}`;
}

/** Returns the cached result, or null. Never throws. */
async function getCachedAnalysis({ kind, userId, profileData, jobDescription }) {
  try {
    const { AiAnalysisCache } = require('../models');
    const inputHash = hashAnalysisInput(profileData, jobDescription);
    const row = await AiAnalysisCache.findOne({
      where: {
        cacheKey: buildKey(kind, userId, inputHash),
        [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }],
      },
    });
    if (!row) return null;
    // Best-effort usage counter; a failure here must not deny the user a hit.
    row.increment('hitCount').catch(() => {});
    return row.resultJson;
  } catch (err) {
    console.warn('[AiAnalysisCache] read failed (continuing uncached):', err.message);
    return null;
  }
}

/** Stores a result. Never throws. */
async function setCachedAnalysis({ kind, userId, profileData, jobDescription, result, ttlDays = DEFAULT_TTL_DAYS }) {
  try {
    const { AiAnalysisCache } = require('../models');
    const inputHash = hashAnalysisInput(profileData, jobDescription);
    await AiAnalysisCache.upsert({
      cacheKey: buildKey(kind, userId, inputHash),
      userId: userId || null,
      kind,
      inputHash,
      resultJson: result,
      expiresAt: ttlDays > 0 ? new Date(Date.now() + ttlDays * 86400000) : null,
    });
  } catch (err) {
    console.warn('[AiAnalysisCache] write failed (result still returned):', err.message);
  }
}

module.exports = { getCachedAnalysis, setCachedAnalysis, hashAnalysisInput };
