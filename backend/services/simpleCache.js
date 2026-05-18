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

function clear() {
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
  clear,
  stats,
};
