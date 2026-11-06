import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatMonthYear, formatDateRange, toIsoMonth, isPresentValue, dateRangeError } from './dateRange.js';

test('a bare year is displayed as a bare year, not an invented month', () => {
  // toIsoMonth maps "2022" to "2022-01" so month inputs have a value; that
  // must not leak into display, where it becomes a date the person never gave.
  assert.equal(formatMonthYear('2022'), '2022');
  assert.equal(formatDateRange('2019', '2022'), '2019 – 2022');
  // The input helper keeps its behaviour — <input type="month"> needs it.
  assert.equal(toIsoMonth('2022'), '2022-01');
});

test('a real month is still formatted as one', () => {
  assert.equal(formatMonthYear('2022-03'), 'Mar 2022');
  assert.equal(formatMonthYear('2022-03-15'), 'Mar 2022');
  assert.equal(formatMonthYear('January 2020'), 'Jan 2020');
});

test('ongoing roles render as Present on either side', () => {
  assert.equal(formatMonthYear('Present'), 'Present');
  assert.equal(formatDateRange('2022-03', 'Present'), 'Mar 2022 – Present');
  // A start with no end is ongoing.
  assert.equal(formatDateRange('2022-03', ''), 'Mar 2022 – Present');
  assert.ok(isPresentValue('Present'));
});

test('missing and unparsable values degrade instead of throwing', () => {
  assert.equal(formatMonthYear(''), '');
  assert.equal(formatMonthYear(null), '');
  assert.equal(formatDateRange('', ''), '');
  assert.equal(formatMonthYear('sometime'), 'sometime');
});

test('dateRangeError flags an end before the start and nothing else', () => {
  assert.equal(dateRangeError('2023-08', '2021-06'), 'The end date is before the start date.');
  assert.equal(dateRangeError('2021-06', '2023-08'), '');
  assert.equal(dateRangeError('2021-06', 'Present'), '');
  assert.equal(dateRangeError('2020', '2020'), '', 'a bare year pair in one year is fine');
  assert.equal(dateRangeError('2020-05', '2020'), '', 'a bare end year covers the whole year');
  assert.equal(dateRangeError('', '2020-01'), '');
  assert.equal(dateRangeError('Sometime', '2020-01'), '');
});
