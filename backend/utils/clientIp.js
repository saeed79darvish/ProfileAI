/**
 * Resolve the real client IP.
 *
 * The API sits behind TWO proxies: Cloudflare (which terminates TLS for
 * api.profilleai.com) and then Render's load balancer. `app.set('trust proxy', 1)`
 * only skips one hop, so `req.ip` resolves to an intermediate address rather
 * than the caller — and because those addresses rotate across the provider's
 * fleet, anything keyed on `req.ip` gets a DIFFERENT key almost every request.
 *
 * The effect measured in production on 2026-08-27: consecutive calls reported
 * `ratelimit-remaining` of 481, then 599, then 599. The counter never
 * accumulates, so the login / register / forgot-password limiters were not
 * actually limiting anyone, and stored `ipAddress` audit values pointed at
 * infrastructure instead of users.
 *
 * The mirror-image failure is worse and is why this is not left alone: if that
 * intermediate address ever stabilises, EVERY user collapses into a single
 * bucket and the whole API starts answering 429 to everyone at once.
 *
 * Cloudflare sets `CF-Connecting-IP` to the original client address on every
 * proxied request, and it is a single value rather than a list, so it needs no
 * hop-counting to interpret. Prefer it, then the left-most `X-Forwarded-For`
 * entry, then whatever Express worked out.
 *
 * SPOOFING: a caller that reaches the Render origin directly, bypassing
 * Cloudflare, can set either header freely — exactly as it could already set
 * `X-Forwarded-For` today, so this is not a new exposure. Closing it properly
 * means restricting the origin to Cloudflare's IP ranges at the platform
 * level; until then treat these values as a spam/abuse signal, not as proof of
 * identity.
 */

function clientIp(req) {
  const cf = req.headers?.['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim();

  // Left-most entry is the original client; everything after it was appended
  // by a proxy along the way.
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

module.exports = { clientIp };
