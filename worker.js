// Cloudflare Worker entry: serve static assets from frontend/build,
// falling back to /index.html for SPA client-side routes.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Keep a single canonical frontend origin so Google OAuth origin checks
    // never see mixed hosts (apex vs www).
    if (url.hostname === 'profilleai.com') {
      url.hostname = 'www.profilleai.com';
      return Response.redirect(url.toString(), 301);
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    url.pathname = '/index.html';
    return env.ASSETS.fetch(new Request(url.toString(), request));
  },
};
