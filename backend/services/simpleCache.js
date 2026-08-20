/**
 * Tiny in-memory LRU-ish cache with TTL.
 *
 * Use for read-heavy endpoints whose data changes slowly relative to traffic
 * (e.g. /external-jobs/companies, /skills, /departments — all aggregations
 * over the corpus that only shift when the cron sync runs).
 *
 * Per-process — fine for a single backend instance, and even multi-instance
 * setups where a cache miss "costs" only one extra DB query. Use Redis if
 * you need cross-process cache coherence.
 *
 * API:
 *   const cache = require('./simpleCache');
 *   const v = cache.get('key');
 *   if (!v) { v = expensive(); cache.set('key', v, 10 * 60 * 1000); }
 *   cache.invalidate('key');           // single key
 *   cache.invalidatePrefix('jobs:');   // bulk invalidate by prefix
 */

const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

const store = new Map(); // key → { value, expiresAt }

function isExpired(entry) {
  return entry.expiresAt > 0 && entry.expiresAt < Date.now();
}

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (isExpired(entry)) {
    store.delete(key);
    return undefined;
  }
  // LRU touch — re-insert to push to most-recent position.
  store.delete(key);
  store.set(key, entry);
  return entry.value;
}

function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  // Evict oldest if at cap.
  if (store.size >= DEFAULT_MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : 0;
  store.set(key, { value, expiresAt });
}

function invalidate(key) {
  store.delete(key);
}

function invalidatePrefix(prefix) {
  for (const key of store.keys()) {
    if (typeof key === 'string' && key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Coalescing prefix invalidation.
 *
 * The corpus sync calls invalidatePrefix('external_jobs:') after every board
 * that changes anything. With 700 boards, a 10-minute sweep budget and a
 * 15-minute cron, that is a ~two-thirds duty cycle firing the invalidation
 * continuously — so the cached job lists (90s TTL) and the company / department
 * / location / skill aggregates (10min TTL) were wiped long before they could
 * ever be reused. Every jobs page load in production was therefore cold: the
 * ranked query, the count, and four full-corpus GROUP BYs all recomputed, in
 * parallel, on the same Postgres the sync was writing to.
 *
 * This was already discovered once for the count cache, which was moved out of
 * the prefix entirely with the note that it "never once hit in production". The
 * list and aggregate caches were left behind under the same prefix.
 *
 * Moving them out too would fix the hit rate and break freshness — those caches
 * genuinely do need dropping when the corpus changes. The frequency is the
 * problem, not the invalidation, so this coalesces a burst of calls into one
 * eviction on a trailing edge. A sweep that touches 300 boards now clears the
 * caches once, shortly after it goes quiet, instead of 300 times while running.
 *
 * The cost is bounded staleness: up to `delayMs` where it used to be immediate.
 * At the default that is well inside the TTLs these entries already carry.
 */
const _pendingInvalidations = new Map(); // prefix → timer

function invalidatePrefixDebounced(prefix, delayMs = 30000) {
  const existing = _pendingInvalidations.get(prefix);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    _pendingInvalidations.delete(prefix);
    invalidatePrefix(prefix);
  }, delayMs);
  // Never hold the event loop open for a cache eviction — if the process is
  // shutting down, an in-memory cache does not need to be cleared first.
  if (typeof timer.unref === 'function') timer.unref();
  _pendingInvalidations.set(prefix, timer);
}

/** Flush any pending debounced invalidation immediately. */
function flushInvalidations() {
  for (const [prefix, timer] of _pendingInvalidations) {
    clearTimeout(timer);
    invalidatePrefix(prefix);
  }
  _pendingInvalidations.clear();
}

function clear() {
  flushInvalidations();
  store.clear();
}

function stats() {
  let alive = 0;
  for (const [, entry] of store) {
    if (!isExpired(entry)) alive++;
  }
  return { total: store.size, alive };
}

module.exports = {
  get,
  set,
  invalidate,
  invalidatePrefix,
  invalidatePrefixDebounced,
  flushInvalidations,
  clear,
  stats,
};
