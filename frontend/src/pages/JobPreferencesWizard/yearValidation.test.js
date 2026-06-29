import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_YEAR,
  getMaxYear,
  validateYear,
  validateYearRange,
} from './yearValidation.js';

// Fixed clock used by tests so they stay deterministic on Jan 1st.
const FIXED_NOW = new Date('2026-06-15T00:00:00Z');
const MAX_AT_FIXED_NOW = FIXED_NOW.getUTCFullYear() + 7; // 2033

test('getMaxYear: returns currentYear + 7', () => {
  assert.equal(getMaxYear(FIXED_NOW), MAX_AT_FIXED_NOW);
});

test('validateYear: empty / whitespace / null / undefined is acceptable', () => {
  assert.equal(validateYear(''), '');
  assert.equal(validateYear('   '), '');
  assert.equal(validateYear(null), '');
  assert.equal(validateYear(undefined), '');
});

test('validateYear: accepts a typical 4-digit year', () => {
  assert.equal(validateYear('2020', { now: FIXED_NOW }), '');
  assert.equal(validateYear('  2020  ', { now: FIXED_NOW }), '');
});

test('validateYear: rejects letters', () => {
  const msg = validateYear('abcd', { now: FIXED_NOW });
  assert.match(msg, /4-digit/);
});

test('validateYear: rejects non-4-digit numeric input', () => {
  const opts = { now: FIXED_NOW };
  assert.match(validateYear('99', opts), /4-digit/);
  assert.match(validateYear('202', opts), /4-digit/);
  assert.match(validateYear('20200', opts), /4-digit/);
  assert.match(validateYear('20.20', opts), /4-digit/);
  assert.match(validateYear('-2020', opts), /4-digit/);
});

test('validateYear: rejects years before MIN_YEAR', () => {
  const msg = validateYear(String(MIN_YEAR - 1), { now: FIXED_NOW });
  assert.match(msg, /between/);
});

test('validateYear: accepts MIN_YEAR boundary', () => {
  assert.equal(validateYear(String(MIN_YEAR), { now: FIXED_NOW }), '');
});

test('validateYear: rejects out-of-range future like 9999', () => {
  const msg = validateYear('9999', { now: FIXED_NOW });
  assert.match(msg, /between/);
});

test('validateYear: accepts the max-year boundary', () => {
  assert.equal(validateYear(String(MAX_AT_FIXED_NOW), { now: FIXED_NOW }), '');
});

test('validateYear: rejects max-year + 1', () => {
  const msg = validateYear(String(MAX_AT_FIXED_NOW + 1), { now: FIXED_NOW });
  assert.match(msg, /between/);
});

test('validateYear: uses fieldLabel in error messages', () => {
  const msg = validateYear('abcd', { fieldLabel: 'Start year', now: FIXED_NOW });
  assert.match(msg, /^Start year /);
});

// ── validateYearRange ────────────────────────────────────────────────────────

test('validateYearRange: both empty is acceptable', () => {
  assert.equal(validateYearRange('', ''), '');
});

test('validateYearRange: one side empty is acceptable', () => {
  assert.equal(validateYearRange('2020', ''), '');
  assert.equal(validateYearRange('', '2020'), '');
});

test('validateYearRange: end before start is rejected with "after start"', () => {
  const msg = validateYearRange('2020', '2018');
  assert.match(msg, /after start/);
});

test('validateYearRange: equal start and end is acceptable', () => {
  assert.equal(validateYearRange('2020', '2020'), '');
});

test('validateYearRange: end after start is acceptable', () => {
  assert.equal(validateYearRange('2018', '2020'), '');
});

test('validateYearRange: defers to per-field validator when shape is bad', () => {
  // The per-field validateYear already surfaces "must be 4-digit" — we
  // don't double-report it here.
  assert.equal(validateYearRange('abc', '2020'), '');
  assert.equal(validateYearRange('2020', 'abc'), '');
  assert.equal(validateYearRange('99', '2020'), '');
});
