import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterQuestions, categoryCounts, monthYear, reportedBy, sourcesFor, safeUrl, sortGuard, pollExpired, progressStep } from './prepLogic.js';

const qs = [
  { id: 'a', text: 'Reverse a list', category: 'coding', mostRecent: '2026-03-10T00:00:00Z', sourceIds: ['s1', 's2'] },
  { id: 'b', text: 'Design a feed', category: 'system_design', mostRecent: null, sourceIds: ['s1'] },
  { id: 'c', text: 'Odd one', category: 'other', mostRecent: '2026-05-01T00:00:00Z', sourceIds: [] },
  { id: 'd', text: '', category: 'coding' },
];

test('filterQuestions: all keeps valid questions, categories narrow', () => {
  assert.equal(filterQuestions(qs, 'all').length, 3);
  assert.deepEqual(filterQuestions(qs, 'coding').map((q) => q.id), ['a']);
  assert.deepEqual(filterQuestions(qs, 'behavioral'), []);
  assert.deepEqual(filterQuestions(null, 'all'), []);
});
test('categoryCounts', () => {
  const c = categoryCounts(qs);
  assert.equal(c.all, 3);
  assert.equal(c.coding, 1);
  assert.equal(c.behavioral, 0);
});
test('monthYear', () => {
  assert.equal(monthYear('2026-03-10T00:00:00Z'), 'March 2026');
  assert.equal(monthYear(null), '');
  assert.equal(monthYear('nope'), '');
});
test('reportedBy pluralises', () => {
  assert.equal(reportedBy(qs[0]), 'Reported by 2 sources');
  assert.equal(reportedBy(qs[1]), 'Reported by 1 source');
  assert.equal(reportedBy({}), 'Reported by 0 sources');
});
test('sourcesFor skips unknown ids', () => {
  const src = [{ id: 's1' }, { id: 's2' }];
  assert.deepEqual(sourcesFor(['s2', 'zz', 's1'], src).map((s) => s.id), ['s2', 's1']);
  assert.deepEqual(sourcesFor(undefined, src), []);
});
test('safeUrl allows only http(s)', () => {
  assert.equal(safeUrl('https://a.com/x'), 'https://a.com/x');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl(''), null);
});
test('sortGuard: newest first, undated last, then source count', () => {
  assert.deepEqual(sortGuard(qs).map((q) => q.id), ['c', 'a', 'b']);
});
test('poll timing', () => {
  assert.equal(pollExpired(0, 89999), false);
  assert.equal(pollExpired(0, 90000), true);
  assert.equal(progressStep(0), 0);
  assert.equal(progressStep(15000), 2);
  assert.equal(progressStep(999999), 3);
});
