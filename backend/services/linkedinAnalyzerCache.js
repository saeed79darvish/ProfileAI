/**
 * LinkedIn Profile Analyzer — server-side cache lookup / write.
 *
 * Shared by both the authed `/analyze-linkedin` route and the guest
 * `/analyze-linkedin-guest` route so we never pay for the same Claude call
 * twice within the TTL. Backed by the `GuestAnalysisCaches` table (see the
 * model) — DB-native so it survives restarts and cross-instance.
 *
 * The cache key uses the same profile-URL normalisation the client-side
 * extension cache uses (origin + pathname, lowercased, no trailing slash)
 * plus a sha256 of a canonicalised scraped-payload subset. Only the fields
 * that materially affect the AI output are hashed — booleans/counts that
 * fluctuate visit-to-visit are ignored so identical profiles don't miss
 * cache on trivial DOM churn.
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const { GuestAnalysisCache } = require('../models');

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const normalizeProfileUrl = (url) => {
  if (!url || typeof url !== 'string' || !/linkedin\.com\/in\//i.test(url)) return null;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return null;
  }
};

/**
 * Canonicalise the scraped payload for hashing. Only include content fields
 * that would actually change the AI verdict.
 */
const canonicalScraped = (scraped) => {
  if (!scraped || typeof scraped !== 'object') return '';
  const cleanStr = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
  const parts = {
    name: cleanStr(scraped.name),
    headline: cleanStr(scraped.headline),
    location: cleanStr(scraped.location),
    currentTitle: cleanStr(scraped.currentTitle),
    currentCompany: cleanStr(scraped.currentCompany),
    about: cleanStr(scraped.about),
    experience: cleanStr(scraped.experience),
    education: cleanStr(scraped.education),
    skills: cleanStr(scraped.skills),
    // Also include a hash-fingerprint of rawText so wildly different
    // profiles with the same top-card don't collide.
    rawTextFingerprint: cleanStr(scraped.rawText).slice(0, 800),
  };
  return JSON.stringify(parts);
};

const scrapedPayloadHash = (scraped) => {
  return crypto.createHash('sha256').update(canonicalScraped(scraped)).digest('hex');
};

/**
 * Normalise a target title into a stable slug for the cache key.
 * Empty / null → 'inferred' (Claude infers the target from the profile).
 * Everything else → lowercase-trim, whitespace collapse, punctuation stripped.
 * We include this in the cache key so that analysing the SAME profile against
 * two different target roles (e.g. Saeed grading Alireza's profile as
 * "Senior Frontend Engineer" vs a guest inferring "VP Machine Learning")
 * produces two DIFFERENT cache rows. Without this, whoever hit the cache
 * first wins and every later reader gets the wrong-target analysis.
 */
const normalizeTargetTitle = (t) => {
  if (t == null) return 'inferred';
  const s = String(t).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]+/g, '');
  return s || 'inferred';
};

const cacheKeyFor = (profileUrlKey, scraped, targetTitle) => {
  return `${profileUrlKey}:${normalizeTargetTitle(targetTitle)}:${scrapedPayloadHash(scraped)}`;
};

/**
 * Look up a cached analysis by (profile URL + target title + scraped hash).
 * Returns null on miss or expiry.
 */
const readCached = async (profileUrlKey, scraped, targetTitle) => {
  if (!profileUrlKey) return null;
  try {
    const key = cacheKeyFor(profileUrlKey, scraped, targetTitle);
    const row = await GuestAnalysisCache.findOne({
      where: {
        cacheKey: key,
        expiresAt: { [Op.gt]: new Date() },
      },
    });
    return row || null;
  } catch (err) {
    console.warn('[linkedinAnalyzerCache] readCached error:', err.message);
    return null;
  }
};

/**
 * Look up ANY still-valid cached analysis for this profile URL.
 *
 * Used by the URL-cap soft-fail path in the guest analyzer: when a
 * profile has been analysed too many times today across all guests, we
 * prefer to serve SOMETHING useful rather than hard-429 the user. But
 * "useful" means "for the target the user just asked for" — returning
 * a cache row that was created for a totally different target role is
 * exactly the bug where Alireza's VP-of-ML profile came back graded
 * as "Senior Frontend Engineer" because Saeed had once run that
 * analysis earlier.
 *
 * So we look up in two passes:
 *   1) A row whose normalised target matches the target the user just
 *      asked for. This is the ideal soft-fail — user asked for
 *      "inferred", we return the last "inferred" analysis of this
 *      profile.
 *   2) If NOTHING with a matching target exists, return null. The
 *      caller then hard-429s the user, which is the correct outcome:
 *      showing a wrong-target analysis is worse than showing a
 *      "you've hit the cap" message.
 *
 * (We deliberately do NOT fall through to "any target as last resort".
 * That was the original design and it produced the wrong-target bug.)
 */
const readAnyCachedForUrl = async (profileUrlKey, targetTitle) => {
  if (!profileUrlKey) return null;
  try {
    // Pass 1: exact normalised-target match. GuestAnalysisCache doesn't
    // store the normalised form directly (we normalise into the cacheKey
    // suffix), so we can filter using a LIKE on cacheKey with the target
    // suffix appended. Every cacheKey we write ends with the sha256 hash,
    // so a substring match on ':<normalised target>:' is unambiguous.
    const normalisedTarget = normalizeTargetTitle(targetTitle);
    const targetFragment = `:${normalisedTarget}:`;
    const row = await GuestAnalysisCache.findOne({
      where: {
        profileUrlKey,
        expiresAt: { [Op.gt]: new Date() },
        cacheKey: { [Op.like]: `%${targetFragment}%` },
      },
      order: [['createdAt', 'DESC']],
    });
    return row || null;
  } catch (err) {
    console.warn('[linkedinAnalyzerCache] readAnyCachedForUrl error:', err.message);
    return null;
  }
};

/**
 * Write a fresh analysis to the cache. Uses upsert semantics on cacheKey.
 */
const writeCached = async ({
  profileUrlKey,
  scraped,
  analysisJson,
  targetTitle,
  modelUsed,
  producedByUserId = null,
  ttlMs = DEFAULT_TTL_MS,
}) => {
  if (!profileUrlKey) return null;
  try {
    const key = cacheKeyFor(profileUrlKey, scraped, targetTitle);
    const hash = scrapedPayloadHash(scraped);
    const expiresAt = new Date(Date.now() + ttlMs);

    // Upsert: if this exact cacheKey already exists, refresh it; else insert.
    const existing = await GuestAnalysisCache.findOne({ where: { cacheKey: key } });
    if (existing) {
      existing.analysisJson = analysisJson;
      existing.targetTitle = targetTitle || existing.targetTitle;
      existing.modelUsed = modelUsed || existing.modelUsed;
      existing.expiresAt = expiresAt;
      if (producedByUserId && !existing.producedByUserId) {
        existing.producedByUserId = producedByUserId;
      }
      await existing.save();
      return existing;
    }

    const row = await GuestAnalysisCache.create({
      cacheKey: key,
      profileUrlKey,
      scrapedPayloadHash: hash,
      analysisJson,
      targetTitle: targetTitle || null,
      modelUsed: modelUsed || null,
      producedByUserId,
      expiresAt,
    });
    return row;
  } catch (err) {
    console.warn('[linkedinAnalyzerCache] writeCached error:', err.message);
    return null;
  }
};

module.exports = {
  normalizeProfileUrl,
  normalizeTargetTitle,
  scrapedPayloadHash,
  cacheKeyFor,
  readCached,
  readAnyCachedForUrl,
  writeCached,
  DEFAULT_TTL_MS,
};
