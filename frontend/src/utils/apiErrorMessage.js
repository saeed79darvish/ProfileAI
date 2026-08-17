// Classifies an API failure into copy a person can act on.
//
// The distinction that matters here: *systemic* failures (the network dropped,
// the API is unreachable, the backend 500s) are the app's problem and get
// announced globally. Ordinary 4xx responses belong to whichever screen made
// the call — those already render inline messages or toasts, so announcing
// them again would double-report every validation error in the app.

export const API_ERROR_KIND = {
  OFFLINE: 'offline',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  SERVER: 'server',
  RATE_LIMIT: 'rate_limit',
  AUTH: 'auth',
  CLIENT: 'client',
};

// announce: show the global banner for this kind.
// duration: auto-dismiss timeout in ms (0 = sticky until dismissed).
const KIND_COPY = {
  [API_ERROR_KIND.OFFLINE]: {
    message: "You're offline. We'll pick up where you left off once the connection is back.",
    announce: true,
    duration: 0,
    canReload: false,
  },
  [API_ERROR_KIND.NETWORK]: {
    message: "Can't reach ProfileAI right now. Check your connection, then try again.",
    announce: true,
    duration: 10000,
    canReload: true,
  },
  [API_ERROR_KIND.TIMEOUT]: {
    message: 'That request took too long and was cancelled. Try again in a moment.',
    announce: true,
    duration: 8000,
    canReload: false,
  },
  [API_ERROR_KIND.SERVER]: {
    message: 'Something went wrong on our end. Try again in a moment.',
    announce: true,
    duration: 10000,
    canReload: true,
  },
  // The AI paywall and the per-endpoint limiters both return 429, and the
  // screens that hit them already open the upgrade / limit-reached modals.
  [API_ERROR_KIND.RATE_LIMIT]: {
    message: "You're going a little fast. Wait a few seconds and try again.",
    announce: false,
    duration: 8000,
    canReload: false,
  },
  // 401/403 are handled by the api.js interceptor (purge + redirect) or are an
  // expected answer on the login form. A banner on top of that is noise.
  [API_ERROR_KIND.AUTH]: {
    message: 'Your session has expired. Sign in again to continue.',
    announce: false,
    duration: 8000,
    canReload: false,
  },
  [API_ERROR_KIND.CLIENT]: {
    message: "That request couldn't be completed.",
    announce: false,
    duration: 8000,
    canReload: false,
  },
};

const TIMEOUT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ERR_CANCELED']);

export function classifyApiError(error) {
  const status = error?.response?.status ?? null;
  const code = error?.code || null;

  // No response at all: DNS failure, connection refused, a CORS preflight the
  // browser rejected, or the tab going offline mid-flight. The browser hides
  // the reason from JS in every one of those cases, so treat them together.
  if (!error?.response) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return API_ERROR_KIND.OFFLINE;
    }
    if (TIMEOUT_CODES.has(code)) return API_ERROR_KIND.TIMEOUT;
    return API_ERROR_KIND.NETWORK;
  }

  if (status >= 500) return API_ERROR_KIND.SERVER;
  if (status === 429) return API_ERROR_KIND.RATE_LIMIT;
  if (status === 401 || status === 403) return API_ERROR_KIND.AUTH;
  return API_ERROR_KIND.CLIENT;
}

// Short technical line for the banner's details row. Deliberately not the
// backend's raw message — those are written for logs, not for users.
function buildDetail(error, status, code) {
  const config = error?.config || {};
  const method = String(config.method || 'get').toUpperCase();
  const path = String(config.url || '').split('?')[0];
  const parts = [];
  if (path) parts.push(`${method} ${path}`);
  if (status) parts.push(String(status));
  else if (code) parts.push(code);
  return parts.join(' · ') || null;
}

/**
 * Normalizes an axios error into everything the banner needs.
 * Returns { kind, message, detail, dedupeKey, announce, duration, canReload }.
 */
export function describeApiError(error) {
  const kind = classifyApiError(error);
  const copy = KIND_COPY[kind] || KIND_COPY[API_ERROR_KIND.CLIENT];
  const status = error?.response?.status ?? null;
  const code = error?.code || null;

  return {
    kind,
    severity: 'error',
    message: copy.message,
    detail: buildDetail(error, status, code),
    // One banner per failure *class*, not per request. A cold backend fails
    // six parallel boot calls at once; the user needs to be told once.
    dedupeKey: `${kind}:${status || code || 'na'}`,
    announce: copy.announce,
    duration: copy.duration,
    canReload: copy.canReload,
  };
}

export default describeApiError;
