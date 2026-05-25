// Cloudflare Worker entry:
// 1. Proxy `/api/*` requests to the Render-hosted backend so the SPA can keep
//    using same-origin URLs (and avoids CORS / cookie issues).
// 2. Serve static assets from the frontend build for everything else, falling
//    back to /index.html for SPA client-side routes.

const BACKEND_ORIGIN = 'https://api.profilleai.com';

// Detect requests for hashed build artifacts. Cloudflare must serve a real
// 404 for these (never the SPA fallback) so that:
//   - lazyWithReload() can detect chunk-load failures and force a reload, and
//   - the browser never receives an HTML body under a `.js`/`.css` URL,
//     which trips the strict-MIME script-loader and breaks the page.
const ASSET_PREFIXES = ['/assets/', '/static/'];
const ASSET_EXTENSIONS = /\.(js|mjs|css|map|woff2?|ttf|otf|eot|svg|png|jpe?g|gif|webp|ico|json|txt|wasm|webmanifest)$/i;

function isAssetRequest(pathname) {
  if (ASSET_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return ASSET_EXTENSIONS.test(pathname);
}

// Patch headers on a response without consuming the body. Used to force
// browsers to revalidate index.html on every refresh so stale HTML (which
// references obsolete hashed chunks) cannot survive a deploy.
function withHeaders(response, headers) {
  const next = new Response(response.body, response);
  for (const [k, v] of Object.entries(headers)) next.headers.set(k, v);
  return next;
}

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

    if (response.status !== 404) {
      // Force HTML documents to revalidate on every load. Hashed JS/CSS
      // assets keep their long-lived immutable caching (set by the static
      // assets binding) since their URLs change on every build.
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        return withHeaders(response, {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        });
      }
      return response;
    }

    // 404 from the static binding. For hashed assets we MUST surface the 404
    // so lazyWithReload triggers a reload — never serve index.html under a
    // `.js`/`.css` URL.
    if (isAssetRequest(url.pathname)) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // SPA fallback for client-side routes.
    url.pathname = '/index.html';
    const fallback = await env.ASSETS.fetch(new Request(url.toString(), request));
    return withHeaders(fallback, {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
  },
};

