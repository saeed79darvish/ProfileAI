const rateLimit = require('express-rate-limit');

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
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // ~40 req/min average; bursts allowed
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
  // Don't rate-limit the Stripe webhook (mounted before this anyway) or health.
  skip: (req) => req.path === '/health',
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests on this endpoint, please wait and retry.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI request rate exceeded. Please wait a moment.' },
});

module.exports = { globalLimiter, strictLimiter, aiLimiter };
