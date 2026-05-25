// Cloudflare Worker entry:
// 1. Proxy `/api/*` requests to the Render-hosted backend so the SPA can keep
//    using same-origin URLs (and avoids CORS / cookie issues).
// 2. Serve static assets from the frontend build for everything else, falling
//    back to /index.html for SPA client-side routes.

const BACKEND_ORIGIN = 'https://api.profilleai.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---- API proxy ----
    if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
      const upstream = new URL(url.pathname + url.search, BACKEND_ORIGIN);
      const hasBody = !['GET', 'HEAD'].includes(request.method);
      // Reuse the original method, headers and body. Keep redirects manual so
      // they're passed back to the browser unchanged.
      // NOTE: when forwarding a streaming body in Cloudflare Workers we MUST
      // set `duplex: 'half'`, otherwise the body is silently dropped — this
      // was the cause of multipart/form-data uploads (resume, profile image)
      // arriving at the backend with no file payload and returning 500.
      const init = {
        method: request.method,
        headers: request.headers,
        body: hasBody ? request.body : undefined,
        redirect: 'manual',
      };
      if (hasBody) init.duplex = 'half';
      return fetch(new Request(upstream.toString(), init));
    }

    // ---- Static asset / SPA fallback ----
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    // Only fall back to index.html for SPA navigations (HTML requests).
    // For missing hashed assets (e.g. /assets/index-OLDHASH.js from a stale
    // index.html in someone's cache) we MUST return the original 404 — if we
    // returned index.html with content-type text/html the browser would
    // refuse to execute it as a module ("Failed to load module script:
    // Expected a JavaScript-or-Wasm module script but the server responded
    // with a MIME type of 'text/html'"), which then crashes the whole app
    // through the error boundary.
    if (url.pathname.startsWith('/assets/')) return response;
    const accept = request.headers.get('Accept') || '';
    if (!accept.includes('text/html')) return response;

    url.pathname = '/index.html';
    return env.ASSETS.fetch(new Request(url.toString(), request));
  },
};
