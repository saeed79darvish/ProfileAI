const test = require('node:test');
const assert = require('node:assert/strict');

const { timeFacts, parseWhen, yearsBetween } = require('./timeFacts');

const NOW = new Date('2026-10-20T12:00:00Z');

test('2021 to now is five years in 2026, not three', () => {
  const text = timeFacts({
    experience: [{ title: 'Senior Software Engineer', company: 'Acme Test Co', startDate: '2021', endDate: 'Present' }],
  }, NOW);
  assert.match(text, /Today is 2026-10-20/);
  assert.match(text, /Acme Test Co: 5 years, and still there/);
});

test('graduating in 2016 was ten years ago', () => {
  assert.match(timeFacts({ education: [{ degree: 'BS CS', endDate: '2016' }] }, NOW), /in 2016: 10 years ago/);
});

test('months are respected when both ends have them', () => {
  assert.equal(yearsBetween(parseWhen('2021-11'), parseWhen('2026-10')), 4);
  assert.equal(yearsBetween(parseWhen('Mar 2021'), parseWhen('2026-10')), 5);
  assert.equal(yearsBetween(parseWhen('2021'), parseWhen('2026')), 5);
});

test('a finished role is measured to its end, not to today', () => {
  const text = timeFacts({ experience: [{ title: 'Dev', company: 'Globex', startDate: '2015', endDate: '2019' }] }, NOW);
  assert.match(text, /Globex: 4 years\./);
  assert.doesNotMatch(text, /still there/);
});

test('a future graduation is not counted as years ago', () => {
  assert.doesNotMatch(timeFacts({ education: [{ degree: 'MSc', endDate: '2028' }] }, NOW), /2028/);
});

test('graduating this year is not "0 years ago"', () => {
  const out = timeFacts({ education: [{ degree: 'BSc CS', endDate: '2026' }] }, new Date('2026-10-30'));
  assert.doesNotMatch(out, /0 years ago/);
  assert.match(out, /this year/);
});
