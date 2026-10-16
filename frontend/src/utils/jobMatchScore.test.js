import { test } from 'node:test';
import assert from 'node:assert/strict';

import { matchTier, orderByMatch, matchLists } from './jobMatchScore.js';

test('matchTier: bands by score, and none without a score', () => {
  assert.equal(matchTier(83).tier, 'strong');
  assert.equal(matchTier(70).tier, 'strong');
  assert.equal(matchTier(62).tier, 'good');
  assert.equal(matchTier(33).tier, 'stretch');
  assert.equal(matchTier(12).tier, 'longshot');
  assert.equal(matchTier(undefined), null);
  assert.equal(matchTier(null), null);
});

test('orderByMatch: known-good first, unscored keep their order, known-poor last', () => {
  const jobs = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
  const scores = { b: { score: 40 }, c: { score: 83 }, e: { score: 72 } };
  assert.deepEqual(orderByMatch(jobs, scores).map((j) => j.id), ['c', 'e', 'a', 'd', 'b']);
});

test('orderByMatch: with no scores the server order is untouched', () => {
  const jobs = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.deepEqual(orderByMatch(jobs, {}).map((j) => j.id), [1, 2, 3]);
});

test('matchLists: splits requirements and keeps knockouts out of the gap list', () => {
  const lists = matchLists({
    requirements: [
      { requirement: 'React', type: 'skill', coverage: 'strong' },
      { requirement: 'Webpack', type: 'skill', coverage: 'none' },
      { requirement: 'Swift', type: 'skill', coverage: 'none' },
      { requirement: 'Mentor juniors', type: 'responsibility', coverage: 'none' },
      { requirement: 'Storybook', type: 'skill', coverage: 'partial' },
    ],
    blockers: [{ requirement: 'Swift', why: 'core of the role' }],
  });
  assert.deepEqual(lists.met.map((r) => r.requirement), ['React']);
  assert.deepEqual(lists.partial.map((r) => r.requirement), ['Storybook']);
  assert.deepEqual(lists.gaps.map((r) => r.requirement), ['Webpack']);
  assert.equal(lists.knockouts.length, 1);
});
