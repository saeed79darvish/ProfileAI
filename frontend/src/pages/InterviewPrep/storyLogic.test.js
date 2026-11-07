import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitSpoken, firstLine, experienceLabel, findSelection, canWrite, writePayload, answersFor, nextRadioIndex, storyError, cleanStories, safeList, safeBeats,
} from './storyLogic.js';

const topics = [
  { id: 't1', theme: 'Conflict', why: 'w', titles: [
    { id: 'a', title: 'The launch', angle: 'x', experienceRef: { company: 'Acme' } },
    { id: 'b', title: 'The rewrite', angle: 'y', experienceRef: { project: 'Atlas' } },
  ] },
  { id: 't2', theme: 'Ownership', why: 'w', titles: [{ id: 'a', title: 'Other', angle: 'z', experienceRef: {} }] },
];

test('splitSpoken marks bracketed placeholders', () => {
  assert.deepEqual(splitSpoken('I cut cost by [number]% in [timeframe].'), [
    { text: 'I cut cost by ', placeholder: false },
    { text: '[number]', placeholder: true },
    { text: '% in ', placeholder: false },
    { text: '[timeframe]', placeholder: true },
    { text: '.', placeholder: false },
  ]);
  assert.deepEqual(splitSpoken('plain'), [{ text: 'plain', placeholder: false }]);
  assert.deepEqual(splitSpoken(null), []);
  assert.equal(splitSpoken('[a][b]').length, 2);
});
test('firstLine', () => {
  assert.equal(firstLine('First one. Second one.'), 'First one.');
  assert.equal(firstLine('  no punctuation here '), 'no punctuation here');
  assert.equal(firstLine('x'.repeat(200), 20).length, 20);
  assert.equal(firstLine(undefined), '');
});
test('experienceLabel', () => {
  assert.equal(experienceLabel({ company: 'Acme' }), 'From your work at Acme');
  assert.equal(experienceLabel({ project: 'Atlas' }), 'From your work at Atlas');
  assert.equal(experienceLabel({}), '');
  assert.equal(experienceLabel(null), '');
});
test('selection validation is scoped to the topic', () => {
  assert.ok(canWrite(topics, { topicId: 't1', titleId: 'b' }));
  assert.ok(!canWrite(topics, { topicId: 't1', titleId: 'zzz' }));
  assert.ok(!canWrite(topics, null));
  assert.ok(!canWrite(null, { topicId: 't1', titleId: 'a' }));
  assert.equal(findSelection(topics, { topicId: 't2', titleId: 'a' }).title.title, 'Other');
});
test('writePayload', () => {
  assert.deepEqual(writePayload('tp1', topics, { topicId: 't1', titleId: 'a' }), {
    tailoredProfileId: 'tp1', theme: 'Conflict', title: 'The launch', experienceRef: { company: 'Acme' },
  });
  assert.equal(writePayload('tp1', topics, { topicId: 'no', titleId: 'a' }), null);
});
test('nextRadioIndex wraps', () => {
  assert.equal(nextRadioIndex('ArrowDown', 2, 3), 0);
  assert.equal(nextRadioIndex('ArrowUp', 0, 3), 2);
  assert.equal(nextRadioIndex('Home', 2, 3), 0);
  assert.equal(nextRadioIndex('End', 0, 3), 2);
  assert.equal(nextRadioIndex('a', 0, 3), null);
  assert.equal(nextRadioIndex('ArrowDown', 0, 0), null);
});
test('storyError maps responses', () => {
  const err = (status, data) => ({ response: { status, data } });
  assert.equal(storyError(err(403, { upgradeRequired: true })).kind, 'upgrade');
  assert.equal(storyError(err(403, { code: 'upgrade_required' })).kind, 'upgrade');
  assert.equal(storyError(err(403, {})).kind, 'retry');
  assert.equal(storyError(err(429, {})).kind, 'limit');
  assert.deepEqual(storyError(err(409, { code: 'not_ready', message: 'Wait' })), { kind: 'message', message: 'Wait' });
  assert.deepEqual(storyError(err(422, { code: 'profile_empty', message: 'Add experience' })), { kind: 'message', message: 'Add experience' });
  assert.equal(storyError(err(500, {})).kind, 'retry');
  assert.equal(storyError(new Error('network')).kind, 'retry');
});
test('cleanStories drops bad rows and sorts newest first', () => {
  const out = cleanStories([
    { id: '1', spoken: 'a', createdAt: '2026-01-01' },
    { id: '2', spoken: 'b', createdAt: '2026-06-01' },
    { id: '3', spoken: '' },
    null,
  ]);
  assert.deepEqual(out.map((s) => s.id), ['2', '1']);
  assert.deepEqual(cleanStories(null), []);
});
test('safeList and safeBeats only return strings', () => {
  assert.deepEqual(safeList(['a', { text: 'b' }, { x: 1 }, 5]), ['a', 'b']);
  assert.deepEqual(safeBeats([{ label: 'Setup', text: 't' }, { label: {}, text: 'u' }, { label: 'x' }]), [
    { label: 'Setup', text: 't' }, { label: '', text: 'u' },
  ]);
});

test('the candidate\'s own words are sent only when they wrote something', () => {
  const topics = [{ id: 't1', theme: 'Performance', titles: [{ id: 't1a', title: 'The slow billing pages', experienceRef: { company: 'Equinix' } }] }];
  const sel = { topicId: 't1', titleId: 't1a' };
  assert.equal('details' in writePayload('tp1', topics, sel), false);
  assert.equal('details' in writePayload('tp1', topics, sel, '   \n  '), false);
  assert.equal(writePayload('tp1', topics, sel, '  Finance could   not close\nthe month.  ').details, 'Finance could not close the month.');
  assert.equal(writePayload('tp1', topics, sel, 'x'.repeat(3000)).details.length, 1200);
});

test('answers to the coach\'s questions are sent only for the ones written', () => {
  const topics = [{ id: 't1', theme: 'Performance', titles: [{ id: 't1a', title: 'The slow billing pages', experienceRef: { company: 'Equinix' } }] }];
  const sel = { topicId: 't1', titleId: 't1a' };
  const qs = [{ id: 'q1', question: 'What was the real problem?' }, { id: 'q2', question: 'Client or server rendering?' }, { id: 'q3', question: 'Hardest part?' }];
  const a = answersFor(qs, { q1: '  Finance could not close the month ', q3: '   ' });
  assert.deepEqual(a, [{ question: 'What was the real problem?', answer: 'Finance could not close the month' }]);
  assert.deepEqual(writePayload('tp1', topics, sel, a).answers, a);
  assert.equal('answers' in writePayload('tp1', topics, sel, answersFor(qs, {})), false);
});
