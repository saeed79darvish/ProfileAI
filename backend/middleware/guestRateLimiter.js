/**
 * Guest rate limiter for the LinkedIn Profile Analyzer teaser flow.
 *
 * The authed `aiRateLimiter` requires `req.user.id` and hard-401s if absent,
 * so it can't guard unauthenticated routes. This middleware enforces two
 * caps across a rolling 24h window, backed by the `GuestAIUsages` table:
 *
 *   1. IP cap  — max N analyses per hashed IP per 24h (default 3).
 *   2. URL cap — max M analyses per profile URL per 24h GLOBALLY (default 2)
 *                → soft-fails on cap-hit if we have a cached result: the
 *                  route reads req.guestContext.urlCapSoftFail and returns
 *                  the cached teaser instead of 429. This avoids two guests
 *                  locking each other out on well-known profiles.
 *
 * IPs are stored SHA-256(ip + GUEST_IP_SALT) so the raw address is never
 * persisted. Falls open (skips the limit, logs a warning) on DB errors so a
 * transient outage can't kill the acquisition surface.
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const { GuestAIUsage } = require('../models');

// Defaults are intentionally generous. The goal isn't to squeeze every last
// free analysis, it's to stop abuse (a script hammering 500 profiles). Real
// users almost never legitimately analyse more than a handful in a day, and
// the ones who do are exactly who we want to convert to a paid account.
// Override at runtime via GUEST_ANALYZER_IP_LIMIT / GUEST_ANALYZER_URL_LIMIT
// so we can tighten prod (or loosen it during a launch push) without a
// deploy.
const parseEnvInt = (name, fallback) => {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};
const DEFAULT_IP_CAP = parseEnvInt('GUEST_ANALYZER_IP_LIMIT', 15);
const DEFAULT_URL_CAP = parseEnvInt('GUEST_ANALYZER_URL_LIMIT', 8);
const WINDOW_MS = 24 * 60 * 60 * 1000;

const getIpSalt = () => {
  // Fall back to JWT_SECRET so we always have SOMETHING even if
  // GUEST_IP_SALT is missing. This is intentional: the salt only needs to
  // be stable within one deploy — rotating it just resets the counters.
  return process.env.GUEST_IP_SALT || process.env.JWT_SECRET || 'profileai-guest-salt';
};

const hashIp = (ip) => {
  return crypto.createHash('sha256').update(String(ip) + '|' + getIpSalt()).digest('hex');
};

/**
 * Normalize a LinkedIn profile URL to a stable cache/limit key.
 * Same format as the extension's client-side cache key.
 */
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
 * @param {object} opts
 * @param {number} [opts.perIpPerDay]
 * @param {number} [opts.perUrlPerDay]
 * @param {(req: any) => string|null} [opts.getProfileUrl]  Extracts the
 *   profile URL from the incoming request (defaults to req.body.scraped.url
 *   || req.body.profileUrl).
 */
const guestAnalysisLimiter = (opts = {}) => {
  const perIpPerDay = Number.isFinite(opts.perIpPerDay) ? opts.perIpPerDay : DEFAULT_IP_CAP;
  const perUrlPerDay = Number.isFinite(opts.perUrlPerDay) ? opts.perUrlPerDay : DEFAULT_URL_CAP;
  const getProfileUrl = opts.getProfileUrl || ((req) => (
    req.body?.profileUrl ||
    req.body?.scraped?.url ||
    null
  ));

  return async (req, res, next) => {
    try {
      const rawIp = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
      const ipHash = hashIp(rawIp);
      const profileUrlKey = normalizeProfileUrl(getProfileUrl(req));

      const windowStart = new Date(Date.now() - WINDOW_MS);

      // Count in parallel — one round-trip to Postgres via Promise.all.
      const [ipCount, urlCount] = await Promise.all([
        GuestAIUsage.count({
          where: {
            ipHash,
            createdAt: { [Op.gte]: windowStart },
          },
        }),
        profileUrlKey
          ? GuestAIUsage.count({
              where: {
                profileUrlKey,
                createdAt: { [Op.gte]: windowStart },
              },
            })
          : Promise.resolve(0),
      ]);

      // Hard block on IP cap — no soft-fail, this one is anti-abuse.
      if (ipCount >= perIpPerDay) {
        return res.status(429).json({
          error: 'guest_daily_limit_ip',
          message: "You've used today's free analyses. Sign in free to keep going — you'll also get paste-ready rewrites and unlimited re-analysis.",
          upgradeSuggestion: 'sign_in',
          retryAfterSeconds: Math.max(60, WINDOW_MS / 1000),
        });
      }

      // URL cap: soft-fail — the route handler will return the cached
      // teaser if one exists, else 429 with a clear message. Passing the
      // flag lets the route make that call with a single Sequelize query.
      const urlCapSoftFail = profileUrlKey ? urlCount >= perUrlPerDay : false;

      req.guestContext = {
        ipHash,
        profileUrlKey,
        userAgent: (req.get('user-agent') || '').slice(0, 500),
        urlCapSoftFail,
        ipCount,
        urlCount,
      };
      next();
    } catch (err) {
      console.warn('[guestRateLimiter] DB error — failing open:', err.message);
      // Fail-open so a transient DB blip doesn't kill the acquisition surface.
      // Set a minimal context so the route still works.
      req.guestContext = {
        ipHash: 'fail-open',
        profileUrlKey: normalizeProfileUrl(getProfileUrl(req)),
        userAgent: (req.get('user-agent') || '').slice(0, 500),
        urlCapSoftFail: false,
        ipCount: 0,
        urlCount: 0,
      };
      next();
    }
  };
};

module.exports = {
  guestAnalysisLimiter,
  hashIp,
  normalizeProfileUrl,
  WINDOW_MS,
  DEFAULT_IP_CAP,
  DEFAULT_URL_CAP,
};
