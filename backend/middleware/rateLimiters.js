const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const crypto = require('crypto');
const { clientIp } = require('../utils/clientIp');

/**
 * Centralized rate limiters.
 *
 * `global` — broad protection on the whole API surface. Generous limit so
 *            normal usage never trips it.
 * `strict` — for sensitive POST endpoints (auth, post creation, messaging,
 *            applypilot kickoff). Smaller window + lower max.
 * `ai`     — for endpoints that hit OpenAI or other paid AI providers. The
 *            per-feature `aiRateLimiter` middleware still enforces business
 *            limits; this is just a cheap edge filter.
 *
 * All three bucket by the CALLER's address rather than `req.ip`. Behind
 * Cloudflare + Render, `req.ip` is an intermediate address that rotates per
 * request, so the counters never accumulated and none of these limiters did
 * anything. See utils/clientIp.js for the measurement and the spoofing
 * caveat.
 */

// `ipKeyGenerator` collapses an IPv6 address to its /56 subnet. Without it a
// single IPv6 client gets a fresh bucket per address it rotates through, which
// would reproduce the same "limiter never accumulates" bug this fix exists to
// remove. express-rate-limit v8 requires it for custom IP-based keys.
const keyByClientIp = (req) => ipKeyGenerator(clientIp(req));

// The key no longer comes from `req.ip`, so express-rate-limit's check that
// `trust proxy` agrees with the X-Forwarded-For header is measuring something
// this file doesn't rely on. Left on, it emits a permanent startup warning
// about a setting that is now irrelevant to bucketing.
const validate = { xForwardedForHeader: false };

/**
 * Load-test escape hatch.
 *
 * Every limiter buckets by IP, so a load generator — which is one IP no matter
 * how many virtual users it simulates — exhausts the global bucket after 600
 * requests and then measures nothing but 429s. That makes it impossible to
 * find the real saturation point.
 *
 * Disabled unless LOADTEST_BYPASS_TOKEN is set to a value of at least 24
 * characters, which is never the case in normal operation. Set it in the
 * environment for the duration of a run and unset it afterwards. The compare
 * is timing-safe so a wrong token can't be discovered a byte at a time.
 */
const BYPASS_TOKEN = process.env.LOADTEST_BYPASS_TOKEN || '';
const BYPASS_ENABLED = BYPASS_TOKEN.length >= 24;

function isLoadTestClient(req) {
  if (!BYPASS_ENABLED) return false;
  const supplied = req.get('x-loadtest-token');
  if (typeof supplied !== 'string' || supplied.length !== BYPASS_TOKEN.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(BYPASS_TOKEN));
}

if (BYPASS_ENABLED) {
  // Loud on purpose: if this is ever on in production without someone
  // deliberately running a load test, the logs should say so.
  // eslint-disable-next-line no-console
  console.warn('[rateLimiters] LOADTEST_BYPASS_TOKEN is set — requests with a matching x-loadtest-token header skip ALL rate limits.');
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // ~40 req/min average; bursts allowed
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
  keyGenerator: keyByClientIp,
  validate,
  // Don't rate-limit the Stripe webhook (mounted before this anyway) or health.
  skip: (req) => req.path === '/health' || isLoadTestClient(req),
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests on this endpoint, please wait and retry.' },
  keyGenerator: keyByClientIp,
  validate,
  skip: isLoadTestClient,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI request rate exceeded. Please wait a moment.' },
  keyGenerator: keyByClientIp,
  validate,
  skip: isLoadTestClient,
});

module.exports = { globalLimiter, strictLimiter, aiLimiter };
