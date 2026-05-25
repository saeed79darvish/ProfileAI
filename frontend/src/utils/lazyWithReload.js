// Wraps React.lazy with auto-retry + one-shot reload on stale-chunk errors.
//
// Background: on every deploy, Vite emits new content-hashed chunk filenames
// (e.g. index-BZgm6MRx.js → index-DKWW7wSS.js). Cloudflare static assets
// drops the old hashes on the next deploy. Any client still running with
// the previous index.html will fail to fetch the old chunks when React.lazy
// tries to load them, throwing:
//   "Failed to fetch dynamically imported module: …index-XXXX.js"
// This bubbles to the root error boundary and the user sees a generic
// crash screen on every refresh / route change after we ship.
//
// Fix: catch that specific class of error and force a single hard reload,
// which fetches the fresh index.html with the current chunk hashes. We
// guard against reload loops via sessionStorage.
//
// Pattern is the standard recommendation from the Vite issue tracker:
// https://github.com/vitejs/vite/issues/11804

import React from 'react';
import { diag } from './diagLogger';

const RELOAD_KEY = 'profileai_chunk_reload_at';
const RELOAD_DEBOUNCE_MS = 10_000; // don't reload more than once per 10s

function isChunkLoadError(err) {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    err?.name === 'ChunkLoadError'
  );
}

function maybeReload(err) {
  try {
    const now = Date.now();
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (now - last < RELOAD_DEBOUNCE_MS) {
      // We just reloaded — don't loop. Let the error propagate so the
      // error boundary shows it.
      diag('chunk.reload.skipped.loopGuard', { last, now, message: err?.message });
      return false;
    }
    sessionStorage.setItem(RELOAD_KEY, String(now));
    diag('chunk.reload.triggered', { message: err?.message });
    // Hard reload so the browser pulls a fresh index.html with the new
    // chunk hashes. Skip cache via the query bust on top of cache headers.
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

/**
 * Drop-in replacement for React.lazy that:
 *  - retries the dynamic import once after 300ms (handles transient flakes)
 *  - on a second failure that looks like a stale-chunk error, force-reloads
 *    the page so the browser fetches the new index.html
 *  - otherwise re-throws so the error boundary catches it normally
 */
export function lazyWithReload(factory) {
  return React.lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (isChunkLoadError(err)) {
        diag('chunk.load.failed.retry', { message: err?.message });
        // Single retry after a short delay — covers transient CDN hiccups.
        await new Promise((r) => setTimeout(r, 300));
        try {
          return await factory();
        } catch (err2) {
          if (isChunkLoadError(err2)) {
            const reloaded = maybeReload(err2);
            if (reloaded) {
              // Return a never-resolving promise so Suspense keeps the
              // spinner up until the reload actually navigates away.
              return new Promise(() => {});
            }
          }
          throw err2;
        }
      }
      throw err;
    }
  });
}

export default lazyWithReload;
