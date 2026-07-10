/**
 * ProfileAI — LinkedIn fetch/XHR shim
 *
 * Runs in the PAGE'S MAIN world at document_start on LinkedIn tabs, BEFORE
 * LinkedIn's aero framework installs its own `window.fetch` / XHR
 * interceptors. Its ONLY job is to short-circuit any request whose URL
 * begins with `chrome-extension://` so that:
 *
 *   1. Dead extension IDs (chrome-extension://invalid/ after an
 *      extension reload) don't spam the console with hundreds of
 *      net::ERR_FAILED errors per second when LinkedIn's Pemberly retry
 *      loop drains its prefetch queue on requestIdleCallback.
 *   2. LinkedIn's queue treats the entry as "done" (we return a synthetic
 *      2xx response) and stops retrying it forever.
 *
 * Safety: LinkedIn has zero legitimate reason to fetch a chrome-extension://
 * URL — those belong to browser extensions, not linkedin.com. Every such
 * request is either a stale prefetch queue entry, DOM URL harvester, or
 * Pemberly telemetry probe, and none of them affect user-facing features.
 *
 * This file is intentionally plain ES5-ish JS with NO imports so it can be
 * loaded directly as a MAIN-world content script (no bundler needed).
 */
(function () {
  'use strict';

  // Idempotency: guard against multiple injections from stale extension
  // reloads. If we've already shimmed this window, bail.
  if (window.__profileaiChromeExtShimInstalled) return;
  window.__profileaiChromeExtShimInstalled = true;

  var CHROME_EXT_PROTO = 'chrome-extension:';

  function urlString(input) {
    try {
      if (typeof input === 'string') return input;
      if (input && typeof input.url === 'string') return input.url; // Request object
      if (input && typeof input.href === 'string') return input.href; // URL object
    } catch (_) { /* ignore */ }
    return '';
  }

  function isChromeExtUrl(url) {
    if (!url) return false;
    // Fast path: startsWith check on the raw string.
    return url.indexOf(CHROME_EXT_PROTO) === 0;
  }

  // ---- fetch shim ------------------------------------------------------
  try {
    var originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = function shimmedFetch(input, init) {
        try {
          if (isChromeExtUrl(urlString(input))) {
            // Return a synthetic 204 No Content so any awaiting caller
            // treats it as a successful, empty response. LinkedIn's aero
            // will then drop the entry from its retry queue.
            return Promise.resolve(new Response(null, {
              status: 204,
              statusText: 'No Content',
              headers: { 'content-type': 'text/plain' },
            }));
          }
        } catch (_) { /* fall through to real fetch */ }
        return originalFetch.apply(this, arguments);
      };
    }
  } catch (_) { /* leave fetch untouched on error */ }

  // ---- XMLHttpRequest shim --------------------------------------------
  // Some LinkedIn code paths use XHR instead of fetch. We stub open() to
  // record the URL, then send() to no-op and synthesise readyState 4 /
  // status 204 so listeners resolve cleanly.
  try {
    var xhrProto = XMLHttpRequest && XMLHttpRequest.prototype;
    if (xhrProto && typeof xhrProto.open === 'function') {
      var origOpen = xhrProto.open;
      var origSend = xhrProto.send;
      var origSetRequestHeader = xhrProto.setRequestHeader;

      xhrProto.open = function shimmedOpen(_method, url) {
        try {
          if (isChromeExtUrl(urlString(url))) {
            this.__profileaiShimmed = true;
          }
        } catch (_) { /* ignore */ }
        return origOpen.apply(this, arguments);
      };

      xhrProto.setRequestHeader = function shimmedSetRequestHeader() {
        if (this.__profileaiShimmed) return; // no-op
        return origSetRequestHeader.apply(this, arguments);
      };

      xhrProto.send = function shimmedSend() {
        if (!this.__profileaiShimmed) return origSend.apply(this, arguments);
        // Simulate a successful empty response, asynchronously.
        var self = this;
        setTimeout(function () {
          try {
            Object.defineProperty(self, 'readyState', { configurable: true, get: function () { return 4; } });
            Object.defineProperty(self, 'status', { configurable: true, get: function () { return 204; } });
            Object.defineProperty(self, 'statusText', { configurable: true, get: function () { return 'No Content'; } });
            Object.defineProperty(self, 'response', { configurable: true, get: function () { return ''; } });
            Object.defineProperty(self, 'responseText', { configurable: true, get: function () { return ''; } });
            if (typeof self.onreadystatechange === 'function') {
              try { self.onreadystatechange(new Event('readystatechange')); } catch (_) {}
            }
            try { self.dispatchEvent(new Event('readystatechange')); } catch (_) {}
            try { self.dispatchEvent(new Event('load')); } catch (_) {}
            try { self.dispatchEvent(new Event('loadend')); } catch (_) {}
          } catch (_) { /* ignore */ }
        }, 0);
      };
    }
  } catch (_) { /* leave XHR untouched on error */ }
})();
