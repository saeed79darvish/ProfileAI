import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { isSpaRoute, LEGACY_REDIRECTS } from './spaRoutes.js';

const appSource = readFileSync(new URL('./frontend/src/App.jsx', import.meta.url), 'utf8');
const appPaths = [...appSource.matchAll(/path="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((p) => p !== '*');

test('every route App.jsx renders is a known SPA route', () => {
  assert.ok(appPaths.length > 40, 'App.jsx route scan found too few paths');
  const missing = appPaths
    .map((p) => p.replace(/:[^/]+/g, 'x').replace(/\/\*$/, '/a/b'))
    .filter((sample) => !isSpaRoute(sample));
  assert.deepEqual(missing, [], 'add these to SPA_ROUTES in spaRoutes.js');
});

test('params and splats match, garbage does not', () => {
  assert.ok(isSpaRoute('/'));
  assert.ok(isSpaRoute('/jobs/123'));
  assert.ok(isSpaRoute('/jobs/123/apply'));
  assert.ok(isSpaRoute('/jobs/'));
  assert.ok(isSpaRoute('/applypilot/inbox/42'));
  assert.ok(isSpaRoute('/auth/linkedin/callback'));
  assert.ok(!isSpaRoute('/asdfgh-garbage'));
  assert.ok(!isSpaRoute('/jobs/123/apply/extra'));
  assert.ok(!isSpaRoute('/privacy-policy'));
  assert.ok(!isSpaRoute('/applypilotx'));
});

test('legacy redirects land on real routes', () => {
  for (const to of Object.values(LEGACY_REDIRECTS)) assert.ok(isSpaRoute(to), to);
});
