const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  totalExperienceYears,
  findTenureClaims,
  auditTenureClaims,
  stripPlaceholderEntries,
  isPlaceholder,
} = require('./resumeHygiene');

/** The real work history from the resume that shipped with both defects. */
const EXPERIENCE = [
  { company: 'Equinix', startDate: '2025-04', current: true },
  { company: 'Amazon AWS', startDate: '2024-05', endDate: '2025-04' },
  { company: 'Restoration Hardware', startDate: '2023-08', endDate: '2024-05' },
  { company: 'Autodesk', startDate: '2021-06', endDate: '2023-08' },
  { company: 'Paypal', startDate: '2021-01', endDate: '2021-06' },
  { company: 'Wells Fargo', startDate: '2019-10', endDate: '2021-01' },
  { company: 'Threedy.ai', startDate: '2019-05', endDate: '2019-10' },
];
const NOW = new Date('2025-10-12T00:00:00Z');

// ── Tenure ──────────────────────────────────────────────────────────────────

test('years come from the dates, not from the number of roles', () => {
  const years = totalExperienceYears(EXPERIENCE, NOW);
  assert.ok(years > 6.2 && years < 6.6, `expected ~6.4, got ${years}`);
});

test('overlapping roles are a single stretch of time, not two', () => {
  const overlapping = [
    { startDate: '2020-01', endDate: '2024-01' },
    { startDate: '2021-01', endDate: '2023-01' }, // a contract held alongside
  ];
  assert.equal(totalExperienceYears(overlapping, NOW), 4);
});

test('a gap between roles is not counted as worked time', () => {
  const gapped = [
    { startDate: '2015-01', endDate: '2016-01' },
    { startDate: '2020-01', endDate: '2021-01' },
  ];
  assert.equal(totalExperienceYears(gapped, NOW), 2);
});

test('a period string is read when start/end dates are absent', () => {
  const years = totalExperienceYears([{ period: '2019 - 2024' }], NOW);
  assert.ok(years > 4.5 && years < 5.5, `got ${years}`);
});

test('tenure claims are found as digits and as words', () => {
  assert.deepEqual(findTenureClaims('eight years of experience').map((c) => c.years), [8]);
  assert.deepEqual(findTenureClaims('8+ years building things').map((c) => c.years), [8]);
  assert.deepEqual(findTenureClaims('10 yrs').map((c) => c.years), [10]);
  assert.deepEqual(findTenureClaims('no claim here'), []);
});

test('the reported defect is caught: "eight years" on a 6.4-year history', () => {
  const summary =
    'Frontend-focused engineer who has spent eight years building UI platforms and component libraries in React and TypeScript.';
  const r = auditTenureClaims(summary, EXPERIENCE, { now: NOW });
  assert.equal(r.clean, false);
  assert.equal(r.inflated.length, 1);
  assert.equal(r.inflated[0].years, 8);
  assert.ok(r.actualYears < 7, 'the posting gate was 7+ and the dates do not reach it');
});

test('rounding a 6.6-year history up to "7 years" is allowed', () => {
  const exp = [{ startDate: '2019-03', current: true }];
  const r = auditTenureClaims('7 years of experience', exp, { now: NOW });
  assert.equal(r.clean, true, `flagged a fair rounding: ${JSON.stringify(r.inflated)}`);
});

test('an honest understatement is never flagged', () => {
  const r = auditTenureClaims('five years of experience', EXPERIENCE, { now: NOW });
  assert.equal(r.clean, true);
});

test('with no dated experience nothing is flagged', () => {
  const r = auditTenureClaims('eight years of experience', [], { now: NOW });
  assert.equal(r.clean, true, 'cannot contradict a claim with no evidence either way');
});

// ── Placeholders ────────────────────────────────────────────────────────────

test('isPlaceholder recognises bracket-only values', () => {
  assert.equal(isPlaceholder('[add institution name]'), true);
  assert.equal(isPlaceholder('[add degree] — '), true);
  assert.equal(isPlaceholder('  '), true);
  assert.equal(isPlaceholder('UCSC Silicon Valley Extension'), false);
});

test('the education entry that shipped with placeholders is dropped', () => {
  // Exactly what appeared on the PDF, under a real entry.
  const draft = {
    education: [
      { school: 'UCSC Silicon Valley Extension', degree: 'Full Stack Development Certificate', field: 'Software Engineering Bootcamp', year: '2018' },
      { school: '[add institution name]', degree: '[add degree]', field: 'Computer Programming, Specific Applications', year: '[add graduation year]' },
    ],
  };
  const { questions } = stripPlaceholderEntries(draft);

  assert.equal(draft.education.length, 1, 'the placeholder entry is still on the resume');
  assert.equal(draft.education[0].school, 'UCSC Silicon Valley Extension');
  // It becomes a question instead of printed text.
  assert.ok(questions.some((q) => q.type === 'education_incomplete'));
  assert.ok(questions.some((q) => /Computer Programming/.test(q.question)));
});

test('a real entry missing only its year keeps the entry and asks for the year', () => {
  const draft = {
    education: [{ school: 'San Jose State', degree: 'BSc', field: 'CS', year: '[add graduation year]' }],
  };
  const { questions } = stripPlaceholderEntries(draft);
  assert.equal(draft.education.length, 1);
  assert.equal(draft.education[0].year, '');
  assert.ok(questions.some((q) => /What year/.test(q.question)));
});

test('no bracketed placeholder survives anywhere a renderer reads', () => {
  const draft = {
    summary: 'Engineer with [add years] of experience.',
    title: 'Staff Engineer',
    education: [{ school: 'MIT', degree: 'BSc', year: '2010' }],
    projects: [{ title: 'Widget ([add year])', description: 'Built a widget.' }],
  };
  stripPlaceholderEntries(draft);
  const rendered = JSON.stringify([draft.summary, draft.title, draft.education, draft.projects]);
  assert.ok(!/\[\s*add/i.test(rendered), `placeholder survived: ${rendered}`);
});

test('a clean draft is left alone', () => {
  const draft = {
    summary: 'Engineer who builds platforms.',
    education: [{ school: 'MIT', degree: 'BSc', field: 'CS', year: '2010' }],
    projects: [{ title: 'Widget (2021)', description: 'Built a widget.' }],
  };
  const { questions, changed } = stripPlaceholderEntries(draft);
  assert.deepEqual(changed, []);
  assert.deepEqual(questions, []);
  assert.equal(draft.education.length, 1);
});

test('junk input does not throw', () => {
  const draft = { education: [null, 'nonsense', {}], projects: [null] };
  assert.doesNotThrow(() => stripPlaceholderEntries(draft));
});
