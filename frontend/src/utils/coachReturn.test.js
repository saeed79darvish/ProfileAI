import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { setCoachReturn, takeCoachReturn, peekCoachReturnMeta, jobReturnPath } = await import('./coachReturn.js');

test.beforeEach(() => store.clear());

test('jobReturnPath opens the job on the board, and asks to tailor only when told to', () => {
  assert.equal(jobReturnPath('abc'), '/jobs?externalJobId=abc');
  assert.equal(jobReturnPath('abc', { tailor: true }), '/jobs?externalJobId=abc&tailor=1');
});

test('jobReturnPath encodes the id so it cannot add params', () => {
  assert.equal(jobReturnPath('a&tailor=1'), '/jobs?externalJobId=a%26tailor%3D1');
});

test('the waiting job is readable without being consumed, then taken once', () => {
  setCoachReturn(jobReturnPath('j1', { tailor: true }), { title: 'Frontend Engineer', company: 'Ramp', tailor: true });
  assert.deepEqual(peekCoachReturnMeta(), { title: 'Frontend Engineer', company: 'Ramp', tailor: true });
  assert.deepEqual(peekCoachReturnMeta(), { title: 'Frontend Engineer', company: 'Ramp', tailor: true });
  assert.equal(takeCoachReturn(), '/jobs?externalJobId=j1&tailor=1');
  assert.equal(takeCoachReturn(), null);
  assert.equal(peekCoachReturnMeta(), null);
});

test('a destination saved without a job title has nothing to show', () => {
  setCoachReturn('/jobs?externalJobId=j1');
  assert.equal(peekCoachReturnMeta(), null);
  assert.equal(takeCoachReturn(), '/jobs?externalJobId=j1');
});

test('an unsafe destination is refused and metadata is bounded', () => {
  setCoachReturn('//evil.com', { title: 'x' });
  assert.equal(takeCoachReturn(), null);
  setCoachReturn('/jobs', { title: 'T'.repeat(500), company: 7 });
  assert.equal(peekCoachReturnMeta().title.length, 120);
  assert.equal(peekCoachReturnMeta().company, '');
});

test('an old attempt expires', () => {
  setCoachReturn('/jobs?externalJobId=j1', { title: 'Old' });
  const raw = JSON.parse(store.get('profileai_coach_return'));
  store.set('profileai_coach_return', JSON.stringify({ ...raw, at: Date.now() - 25 * 60 * 60 * 1000 }));
  assert.equal(peekCoachReturnMeta(), null);
  assert.equal(takeCoachReturn(), null);
});
