import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { buildFixtures, OUT_DIR } from './build-fixtures.mjs';

let P;
before(async () => {
  await buildFixtures();
  P = await import(resolve(OUT_DIR, 'pendingApplication.mjs'));
});

test('normalizeJobUrl strips tracking params, www, hash and trailing slash', () => {
  assert.equal(
    P.normalizeJobUrl('https://www.Example.com/jobs/123/?utm_source=x&gh_src=abc&ref=li&id=7#apply'),
    'example.com/jobs/123?id=7',
  );
  assert.equal(P.normalizeJobUrl(''), '');
  assert.equal(P.normalizeJobUrl(null), '');
});

test('sameJobUrl ignores tracking noise but not real differences', () => {
  assert.ok(P.sameJobUrl('https://boards.greenhouse.io/a/jobs/1?gh_src=z', 'https://boards.greenhouse.io/a/jobs/1/'));
  assert.ok(!P.sameJobUrl('https://x.com/jobs/1', 'https://x.com/jobs/2'));
  assert.ok(!P.sameJobUrl('', ''));
});

test('pickPending skips the job the person is on', () => {
  const list = [
    { id: 'a', jobTitle: 'A', company: 'X', jobUrl: 'https://x.com/jobs/1?utm_medium=e' },
    { id: 'b', jobTitle: 'B', company: 'Y', jobUrl: 'https://y.com/jobs/2' },
  ];
  assert.equal(P.pickPending(list, 'https://x.com/jobs/1').id, 'b');
  assert.equal(P.pickPending(list, 'https://z.com/').id, 'a');
  assert.equal(P.pickPending([list[0]], 'https://x.com/jobs/1'), null);
  assert.equal(P.pickPending(null, ''), null);
});

test('relativeTime phrases', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  const ago = (ms) => new Date(now - ms).toISOString();
  assert.equal(P.relativeTime(ago(30000), now), 'just now');
  assert.equal(P.relativeTime(ago(35 * 60000), now), '35 minutes ago');
  assert.equal(P.relativeTime(ago(3600000), now), '1 hour ago');
  assert.equal(P.relativeTime(ago(5 * 3600000), now), '5 hours ago');
  assert.equal(P.relativeTime(ago(30 * 3600000), now), 'yesterday');
  assert.equal(P.relativeTime(ago(4 * 86400000), now), '4 days ago');
  assert.equal(P.relativeTime(ago(21 * 86400000), now), '3 weeks ago');
  assert.equal(P.relativeTime('garbage', now), 'earlier');
});
