// Tiny pub/sub between the axios layer and the UI.
//
// api.js is a plain module — it can't call a React hook — so failures are
// published here and <ApiErrorBanner /> subscribes. Anything published before
// the banner mounts is buffered, which is exactly the case that matters:
// the boot-time burst of calls (auth/me, notifications, usage) fires while
// React is still mounting the tree.

import { describeApiError } from '../utils/apiErrorMessage';

const listeners = new Set();
const pending = [];
const MAX_PENDING = 5;

let nextId = 0;

function emit(entry) {
  if (listeners.size === 0) {
    pending.push(entry);
    if (pending.length > MAX_PENDING) pending.shift();
    return entry.id;
  }
  listeners.forEach((fn) => {
    try {
      fn(entry);
    } catch (err) {
      // A broken listener must never break the request that reported the error.
      // eslint-disable-next-line no-console
      console.error('[errorBus] listener threw:', err);
    }
  });
  return entry.id;
}

export function subscribeApiErrors(listener) {
  listeners.add(listener);
  if (pending.length) {
    const buffered = pending.splice(0, pending.length);
    buffered.forEach((entry) => listener(entry));
  }
  return () => listeners.delete(listener);
}

/**
 * Publish an axios error. Silently ignored unless the failure is systemic
 * (see describeApiError) — screens keep owning their own 4xx messaging.
 *
 * Opt out per request with `{ meta: { silent: true } }` on the axios config,
 * or force a banner for a call whose failure the screen can't surface with
 * `{ meta: { announceError: true } }`.
 */
export function publishApiError(error) {
  const meta = error?.config?.meta || {};
  if (meta.silent) return null;

  const described = describeApiError(error);
  if (!described.announce && !meta.announceError) return null;

  return emit({ ...described, id: ++nextId, source: 'api' });
}

/**
 * Push a message into the same banner by hand — for failures that never went
 * through axios (a file read, a postMessage relay, a worker that gave up).
 */
export function reportError(message, options = {}) {
  if (!message) return null;
  return emit({
    id: ++nextId,
    kind: options.kind || 'manual',
    severity: options.severity || 'error',
    message,
    detail: options.detail || null,
    dedupeKey: options.dedupeKey || `manual:${message}`,
    duration: options.duration ?? 8000,
    canReload: options.canReload || false,
    source: 'manual',
  });
}

export default { subscribeApiErrors, publishApiError, reportError };
