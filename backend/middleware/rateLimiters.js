const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

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
 */

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
  // Don't rate-limit the Stripe webhook (mounted before this anyway) or health.
  skip: (req) => req.path === '/health' || isLoadTestClient(req),
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests on this endpoint, please wait and retry.' },
  skip: isLoadTestClient,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI request rate exceeded. Please wait a moment.' },
  skip: isLoadTestClient,
});

module.exports = { globalLimiter, strictLimiter, aiLimiter };
