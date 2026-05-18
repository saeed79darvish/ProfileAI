// Cloudflare Worker entry: serve static assets from frontend/build,
// falling back to /index.html for SPA client-side routes.
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;
    const url = new URL(request.url);
    url.pathname = '/index.html';
    return env.ASSETS.fetch(new Request(url.toString(), request));
  },
};
