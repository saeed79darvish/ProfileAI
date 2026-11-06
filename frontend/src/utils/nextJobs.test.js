import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listParamsFromQuery, pickNext, matchPercent, fetchNextJobs } from './nextJobs.js';

const j = (id, extra = {}) => ({ id, title: `T${id}`, company: `C${id}`, ...extra });

test('listParamsFromQuery keeps only list filters', () => {
  assert.deepEqual(
    listParamsFromQuery('?search=dev&location=Berlin&externalJobId=9&tailor=1'),
    { search: 'dev', location: 'Berlin' },
  );
  assert.deepEqual(listParamsFromQuery(''), {});
});

test('pickNext dedupes, excludes and caps', () => {
  const out = pickNext([j(1), j(2), j(2), j(3), j(4), j(5)], { excludeId: 1, applied: [3], limit: 3 });
  assert.deepEqual(out.map((x) => x.id), [2, 4, 5]);
});

test('pickNext drops a repost of the applied role', () => {
  const out = pickNext([{ id: 9, title: 'Dev ', company: 'ACME' }, j(2)], { current: { title: 'dev', company: 'Acme' } });
  assert.deepEqual(out.map((x) => x.id), [2]);
});

test('matchPercent', () => {
  assert.equal(matchPercent({ relevanceScore: 87.4 }), 87);
  assert.equal(matchPercent({ similarityScore: 0.62 }), 62);
  assert.equal(matchPercent({}), null);
});

test('fetchNextJobs: saved first, skips applied, stops when full', async () => {
  let allCalls = 0;
  const api = {
    getSaved: async () => ({ data: { savedJobs: [j(1), j(2), j(3), j(4)] } }),
    getAll: async () => { allCalls += 1; return { data: { jobs: [j(8)] } }; },
    checkApplied: async () => ({ data: { appliedExternalJobIds: [2] } }),
  };
  const out = await fetchNextJobs(api, { jobId: 1 });
  assert.deepEqual(out.map((x) => x.id), [3, 4, 8]);
  assert.equal(allCalls, 1);
});

test('fetchNextJobs: survives failing sources', async () => {
  const api = {
    getSaved: async () => { throw new Error('x'); },
    getAll: async () => ({ data: { jobs: [j(5), j(6)] } }),
    checkApplied: async () => { throw new Error('x'); },
  };
  const out = await fetchNextJobs(api, { company: 'Z', listQuery: '?search=a' });
  assert.deepEqual(out.map((x) => x.id), [5, 6]);
});
