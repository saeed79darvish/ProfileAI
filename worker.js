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
      // Reuse the original method, headers and body. Keep redirects manual so
      // they're passed back to the browser unchanged.
      const proxied = new Request(upstream.toString(), {
        method: request.method,
        headers: request.headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual',
      });
      return fetch(proxied);
    }

    // ---- Static asset / SPA fallback ----
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;
    url.pathname = '/index.html';
    return env.ASSETS.fetch(new Request(url.toString(), request));
  },
};
