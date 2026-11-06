import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { save, load, clear, shouldAskOnReturn } from './applyDeparture.js';

const MIN = 60000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-11-06T12:00:00Z');

beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

test('save, load and clear round trip', () => {
  save({ applicationId: 'a1', jobId: 'j1', title: 'Dev', company: 'Acme', applyUrl: 'https://x.test', listQuery: '?search=dev', at: NOW });
  const d = load();
  assert.equal(d.applicationId, 'a1');
  assert.equal(d.listQuery, '?search=dev');
  clear();
  assert.equal(load(), null);
});

test('unknown application id stays null', () => {
  save({ jobId: 'j1', at: NOW });
  assert.equal(load().applicationId, null);
});

test('storage failures never throw', () => {
  globalThis.localStorage = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.equal(save({ at: NOW }), null);
  assert.equal(load(), null);
  clear();
});

test('corrupt storage reads as nothing', () => {
  localStorage.setItem('profilleai.applyDeparture', '{nope');
  assert.equal(load(), null);
});

test('shouldAskOnReturn: needs a minute away', () => {
  const d = { at: NOW - 10 * MIN };
  assert.equal(shouldAskOnReturn(d, NOW, 59000), false);
  assert.equal(shouldAskOnReturn(d, NOW, 60000), true);
});

test('shouldAskOnReturn: fresh load uses time since departure', () => {
  assert.equal(shouldAskOnReturn({ at: NOW - 30000 }, NOW, null), false);
  assert.equal(shouldAskOnReturn({ at: NOW - 2 * MIN }, NOW, null), true);
});

test('shouldAskOnReturn: expires after six hours, ignores bad input', () => {
  assert.equal(shouldAskOnReturn({ at: NOW - 6 * HOUR }, NOW, 7 * HOUR), false);
  assert.equal(shouldAskOnReturn({ at: NOW - 5 * HOUR }, NOW, null), true);
  assert.equal(shouldAskOnReturn(null, NOW, 5 * MIN), false);
  assert.equal(shouldAskOnReturn({ at: NOW + MIN }, NOW, 5 * MIN), false);
});
