// The bookmarklet runs on arbitrary third-party job-site origins (linkedin.com,
// myworkdayjobs.com, ...), so unlike the rest of this app's API calls it can't
// use the same-origin `/api` path proxied by the Cloudflare worker — it has to
// address the backend directly. Mirrors chrome-extension-react/src/config.ts,
// which hardcodes the same split for the same reason.
const API_ORIGIN = import.meta.env.VITE_BOOKMARKLET_API_ORIGIN
  || (import.meta.env.DEV ? 'http://localhost:5001' : 'https://api.profilleai.com');

export function buildBookmarkletUri(token) {
  const src = `${API_ORIGIN}/bookmarklet.js?t=${encodeURIComponent(token)}&v=1`;
  return `javascript:(function(){var s=document.createElement('script');s.src='${src}';document.body.appendChild(s);})()`;
}

export default { API_ORIGIN, buildBookmarkletUri };
