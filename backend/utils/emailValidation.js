const dns = require('dns/promises');
const disposableDomains = require('disposable-email-domains');

// Build a Set for O(1) lookup
const disposableSet = new Set(disposableDomains.map((d) => d.toLowerCase()));

// In-memory cache for MX lookups so we don't re-resolve the same domain
// for every signup attempt. Cache for 1 hour.
const mxCache = new Map(); // domain -> { ok: boolean, expiresAt: number }
const MX_CACHE_TTL_MS = 60 * 60 * 1000;

function extractDomain(email) {
  if (typeof email !== 'string') return null;
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

function isDisposableDomain(domain) {
  if (!domain) return false;
  return disposableSet.has(domain);
}

async function hasMxRecord(domain) {
  if (!domain) return false;
  const cached = mxCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) return cached.ok;
  let ok = false;
  try {
    const records = await dns.resolveMx(domain);
    ok = Array.isArray(records) && records.length > 0;
  } catch (_) {
    ok = false;
  }
  mxCache.set(domain, { ok, expiresAt: Date.now() + MX_CACHE_TTL_MS });
  return ok;
}

/**
 * Validate an email address for signup. Returns { valid, reason }.
 * - Rejects disposable / throwaway domains.
 * - Rejects domains that have no MX record (typos, fake TLDs).
 * Email format itself is validated upstream by express-validator.
 */
async function validateSignupEmail(email) {
  const domain = extractDomain(email);
  if (!domain) {
    return { valid: false, reason: 'Please provide a valid email address.' };
  }
  if (isDisposableDomain(domain)) {
    return { valid: false, reason: 'Disposable email addresses are not allowed. Please use a permanent email.' };
  }
  const mxOk = await hasMxRecord(domain);
  if (!mxOk) {
    return { valid: false, reason: 'This email domain cannot receive mail. Please check for typos.' };
  }
  return { valid: true };
}

module.exports = {
  validateSignupEmail,
  isDisposableDomain,
  hasMxRecord,
  extractDomain
};
