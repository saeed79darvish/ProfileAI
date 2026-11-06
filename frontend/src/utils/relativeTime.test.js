import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relativeTimeAgo } from './relativeTime.js';

const NOW = Date.parse('2026-11-06T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const MIN = 60000;

test('relativeTimeAgo: under a minute', () => {
  assert.equal(relativeTimeAgo(ago(20000), NOW), 'just now');
  assert.equal(relativeTimeAgo(ago(-5000), NOW), 'just now');
});
test('relativeTimeAgo: minutes and hours', () => {
  assert.equal(relativeTimeAgo(ago(MIN), NOW), '1 minute ago');
  assert.equal(relativeTimeAgo(ago(25 * MIN), NOW), '25 minutes ago');
  assert.equal(relativeTimeAgo(ago(60 * MIN), NOW), '1 hour ago');
  assert.equal(relativeTimeAgo(ago(5 * 60 * MIN), NOW), '5 hours ago');
});
test('relativeTimeAgo: days and months', () => {
  assert.equal(relativeTimeAgo(ago(30 * 60 * MIN), NOW), 'yesterday');
  assert.equal(relativeTimeAgo(ago(4 * 24 * 60 * MIN), NOW), '4 days ago');
  assert.equal(relativeTimeAgo(ago(65 * 24 * 60 * MIN), NOW), '2 months ago');
});
test('relativeTimeAgo: bad input', () => {
  assert.equal(relativeTimeAgo('nope', NOW), 'earlier');
  assert.equal(relativeTimeAgo(undefined, NOW), 'earlier');
});
