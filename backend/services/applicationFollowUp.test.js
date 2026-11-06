const test = require('node:test');
const assert = require('node:assert/strict');
const { changesForAnswer, pendingWhere, SNOOZE_DAYS } = require('./applicationFollowUp');

const NOW = new Date('2026-11-06T12:00:00Z');

test('yes marks a started application as applied by the user', () => {
  const c = changesForAnswer({ status: 'in_progress' }, 'applied', NOW);
  assert.equal(c.status, 'applied');
  assert.equal(c.confirmedBy, 'user');
  assert.equal(c.snoozedUntil, null);
});

test('not yet snoozes and does not change the status', () => {
  const c = changesForAnswer({ status: 'clicked' }, 'not_yet', NOW);
  assert.equal(c.status, undefined);
  assert.equal(c.snoozedUntil.getTime() - NOW.getTime(), SNOOZE_DAYS * 24 * 3600 * 1000);
});

test('not applying dismisses it for good', () => {
  const c = changesForAnswer({ status: 'in_progress' }, 'not_applying', NOW);
  assert.ok(c.dismissedAt);
});

test('an already confirmed application, or a bad answer, changes nothing', () => {
  assert.equal(changesForAnswer({ status: 'applied' }, 'applied', NOW), null);
  assert.equal(changesForAnswer({ status: 'in_progress' }, 'maybe', NOW), null);
});

test('only recent, quiet, undismissed, unsnoozed started applications are pending', () => {
  const w = pendingWhere('u1', NOW);
  assert.equal(w.userId, 'u1');
  assert.equal(w.dismissedAt, null);
  assert.deepEqual(Object.getOwnPropertySymbols(w.status).length, 1);
});
