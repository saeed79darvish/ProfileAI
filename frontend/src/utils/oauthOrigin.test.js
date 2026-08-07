import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalOrigin,
  oauthRedirectUri,
  isOnCanonicalOrigin,
  goToCanonicalOrigin,
} from './oauthOrigin.js';

const CANONICAL = 'https://www.profilleai.com';

// Stubs the browser globals the module reads. Returns whatever `replace` was
// called with so the redirect helper can be asserted on.
const atLocation = (href, fn) => {
  const url = new URL(href);
  let replacedWith = null;
  globalThis.window = {
    location: {
      hostname: url.hostname,
      origin: url.origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      replace: (target) => { replacedWith = target; },
    },
  };
  try {
    fn();
    return replacedWith;
  } finally {
    delete globalThis.window;
  }
};

// ── canonicalOrigin ───────────────────────────────────────────────────────────

test('canonicalOrigin: rewrites the bare apex to the www host', () => {
  atLocation('https://profilleai.com/register', () => {
    assert.equal(canonicalOrigin(), CANONICAL);
  });
});

test('canonicalOrigin: leaves the canonical host alone', () => {
  atLocation('https://www.profilleai.com/register', () => {
    assert.equal(canonicalOrigin(), CANONICAL);
  });
});

test('canonicalOrigin: leaves dev and preview origins alone', () => {
  atLocation('http://localhost:3000/register', () => {
    assert.equal(canonicalOrigin(), 'http://localhost:3000');
  });
  atLocation('https://profileai.s79darvish.workers.dev/register', () => {
    assert.equal(canonicalOrigin(), 'https://profileai.s79darvish.workers.dev');
  });
});

// ── oauthRedirectUri ──────────────────────────────────────────────────────────

test('oauthRedirectUri: builds the callback on the canonical origin from the apex', () => {
  atLocation('https://profilleai.com/register', () => {
    assert.equal(
      oauthRedirectUri('/auth/linkedin/callback'),
      `${CANONICAL}/auth/linkedin/callback`
    );
  });
});

test('oauthRedirectUri: keeps localhost callbacks on localhost', () => {
  atLocation('http://localhost:3000/profile/create', () => {
    assert.equal(
      oauthRedirectUri('/auth/linkedin/callback'),
      'http://localhost:3000/auth/linkedin/callback'
    );
  });
});

// ── isOnCanonicalOrigin ───────────────────────────────────────────────────────

test('isOnCanonicalOrigin: false on the apex, true on www and in dev', () => {
  atLocation('https://profilleai.com/register', () => {
    assert.equal(isOnCanonicalOrigin(), false);
  });
  atLocation('https://www.profilleai.com/register', () => {
    assert.equal(isOnCanonicalOrigin(), true);
  });
  atLocation('http://localhost:3000/register', () => {
    assert.equal(isOnCanonicalOrigin(), true);
  });
});

// ── goToCanonicalOrigin ───────────────────────────────────────────────────────

test('goToCanonicalOrigin: preserves path, query and hash', () => {
  const target = atLocation('https://profilleai.com/register?ref=abc#top', goToCanonicalOrigin);
  assert.equal(target, `${CANONICAL}/register?ref=abc#top`);
});
