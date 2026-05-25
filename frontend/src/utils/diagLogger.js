// Persistent, prod-safe diagnostic logger.
//
// Goal: trace the refresh-on-/profile crash across the page-reload boundary.
// The standard console gets wiped on navigation/refresh, so we keep a small
// ring buffer in sessionStorage (per-tab) AND a longer ring in localStorage
// (across reloads). Every entry is also echoed to console.log with a tag so
// it's visible in normal devtools too.
//
// This is intentionally heavy-handed for diagnostics. Remove the import
// sites + this file once we have the root cause.

const SESSION_KEY = 'profileai_diag_log';
const PERSIST_KEY = 'profileai_diag_log_persist';
const MAX_ENTRIES = 200;

function safeRead(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function safeWrite(storage, key, arr) {
  try {
    storage.setItem(key, JSON.stringify(arr.slice(-MAX_ENTRIES)));
  } catch { /* quota / private mode */ }
}

function snapshotAuth() {
  try {
    const token = localStorage.getItem('token');
    const userRaw = localStorage.getItem('user');
    let user = null;
    try { user = userRaw ? JSON.parse(userRaw) : null; } catch { /* noop */ }
    return {
      hasToken: !!token,
      tokenLen: token ? token.length : 0,
      userId: user?.id || null,
      role: user?.role || null,
      emailVerified: user?.emailVerified ?? null,
      hasProfile: user?.hasProfile ?? null,
      subscriptionTier: user?.subscriptionTier || null,
    };
  } catch {
    return { hasToken: false };
  }
}

export function diag(tag, data) {
  const entry = {
    ts: new Date().toISOString(),
    t: Date.now(),
    tag,
    url: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
    auth: snapshotAuth(),
    data: data === undefined ? null : sanitize(data),
  };

  // eslint-disable-next-line no-console
  console.log('[diag]', tag, entry);

  try {
    if (typeof sessionStorage !== 'undefined') {
      const arr = safeRead(sessionStorage, SESSION_KEY);
      arr.push(entry);
      safeWrite(sessionStorage, SESSION_KEY, arr);
    }
  } catch { /* noop */ }

  try {
    if (typeof localStorage !== 'undefined') {
      const arr = safeRead(localStorage, PERSIST_KEY);
      arr.push(entry);
      safeWrite(localStorage, PERSIST_KEY, arr);
    }
  } catch { /* noop */ }
}

function sanitize(value, depth = 0) {
  if (depth > 4) return '[depth]';
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'string') return value.length > 500 ? value.slice(0, 500) + '…' : value;
  if (t === 'number' || t === 'boolean') return value;
  if (value instanceof Error) {
    return { __error: true, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (t === 'object') {
    const out = {};
    let i = 0;
    for (const k of Object.keys(value)) {
      if (i++ > 30) { out.__truncated = true; break; }
      // drop obviously sensitive keys
      if (/password|token|secret|authorization/i.test(k)) {
        out[k] = '[redacted]';
        continue;
      }
      try { out[k] = sanitize(value[k], depth + 1); } catch { out[k] = '[unserializable]'; }
    }
    return out;
  }
  return String(value);
}

export function getDiagLog() {
  const session = typeof sessionStorage !== 'undefined' ? safeRead(sessionStorage, SESSION_KEY) : [];
  const persist = typeof localStorage !== 'undefined' ? safeRead(localStorage, PERSIST_KEY) : [];
  return { session, persist };
}

export function clearDiagLog() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
  try { localStorage.removeItem(PERSIST_KEY); } catch { /* noop */ }
}

export function installDiagWindowHelpers() {
  if (typeof window === 'undefined') return;
  window.__profileaiDiag = () => {
    const { session, persist } = getDiagLog();
    // eslint-disable-next-line no-console
    console.log('--- session (this tab) ---');
    // eslint-disable-next-line no-console
    console.table(session.map(({ ts, tag, url, data }) => ({ ts, tag, url, data: data ? JSON.stringify(data).slice(0, 120) : '' })));
    // eslint-disable-next-line no-console
    console.log('--- persist (across reloads) ---');
    // eslint-disable-next-line no-console
    console.table(persist.map(({ ts, tag, url, data }) => ({ ts, tag, url, data: data ? JSON.stringify(data).slice(0, 120) : '' })));
    return { session, persist };
  };
  window.__profileaiDiagClear = clearDiagLog;
  window.__profileaiDiagRaw = getDiagLog;
}

// Hook global error + unhandled rejection so anything we miss still lands here.
if (typeof window !== 'undefined' && !window.__profileaiDiagInstalled) {
  window.__profileaiDiagInstalled = true;
  window.addEventListener('error', (e) => {
    diag('window.error', {
      message: e?.message,
      filename: e?.filename,
      lineno: e?.lineno,
      colno: e?.colno,
      error: e?.error ? { message: e.error.message, stack: e.error.stack } : null,
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e?.reason;
    diag('window.unhandledrejection', {
      reason: reason instanceof Error
        ? { message: reason.message, stack: reason.stack }
        : sanitize(reason),
    });
  });
  diag('diag.installed', {
    userAgent: navigator.userAgent,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    performanceNavType: (() => {
      try {
        const nav = performance.getEntriesByType('navigation')[0];
        return nav ? { type: nav.type, redirectCount: nav.redirectCount } : null;
      } catch { return null; }
    })(),
  });
  installDiagWindowHelpers();
}

export default diag;
