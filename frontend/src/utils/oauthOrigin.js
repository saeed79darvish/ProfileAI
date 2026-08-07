// Canonical-origin helpers for the OAuth popup handshake.
//
// The site is canonicalised to https://www.profilleai.com — worker.js (and a
// Cloudflare redirect rule in front of it) 301s the bare apex and any http://
// request onto that host.
//
// That matters for OAuth because a popup has to come back on the SAME origin as
// the window that opened it: the callback page posts its payload with
// `targetOrigin` set to its own origin, and the opener drops anything whose
// `event.origin` doesn't match. A flow started on the apex sends the apex as
// its redirect_uri, the provider redirects there, the 301 moves the popup to
// www — and the handshake is silently lost, leaving the opener spinning.
//
// The canonical host is also the only origin registered with the providers, so
// starting anywhere else fails at their end anyway.

const CANONICAL_ORIGIN = 'https://www.profilleai.com';

// Hosts that the canonical redirect applies to. Localhost, preview builds and
// *.workers.dev keep whatever origin they're on — they have their own redirect
// URIs registered and nothing rewrites their host mid-flight.
const REDIRECTED_HOSTS = ['profilleai.com', 'www.profilleai.com'];

export const canonicalOrigin = () => (
  REDIRECTED_HOSTS.includes(window.location.hostname)
    ? CANONICAL_ORIGIN
    : window.location.origin
);

// Redirect URI to hand a provider. Always on the origin the popup will be
// allowed to talk back to.
export const oauthRedirectUri = (path) => `${canonicalOrigin()}${path}`;

export const isOnCanonicalOrigin = () => window.location.origin === canonicalOrigin();

// Moves the page onto the canonical origin, preserving where the user was.
// Callers use this instead of opening a popup that could never post back.
export const goToCanonicalOrigin = () => {
  const { pathname, search, hash } = window.location;
  window.location.replace(`${canonicalOrigin()}${pathname}${search}${hash}`);
};
