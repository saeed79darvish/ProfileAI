const { test } = require('node:test');
const assert = require('node:assert/strict');

const { normalizeTitleForCompare, seniorityBand, compareTitles } = require('./titleMatch');

test('the seniority band is read out of the title', () => {
  assert.equal(seniorityBand('Staff Software Engineer'), 'staff');
  assert.equal(seniorityBand('Senior Software Engineer'), 'senior');
  assert.equal(seniorityBand('Sr. Software Engineer'), 'senior');
  assert.equal(seniorityBand('Principal Engineer'), 'principal');
  assert.equal(seniorityBand('Engineering Manager'), 'manager');
  assert.equal(seniorityBand('Tech Lead'), 'lead');
  assert.equal(seniorityBand('Junior Developer'), 'junior');
  assert.equal(seniorityBand('Director of Engineering'), 'director');
  assert.equal(seniorityBand('VP of Product'), 'vp');
  // A bare title genuinely has no band and must not be given one.
  assert.equal(seniorityBand('Software Engineer'), null);
});

test('compound bands resolve to the more specific one', () => {
  // "Senior Staff" is a staff-level role, not a senior one. Ordering matters.
  assert.equal(seniorityBand('Senior Staff Software Engineer'), 'senior-staff');
  assert.equal(seniorityBand('Senior Principal Engineer'), 'senior-principal');
});

test('normalisation strips job-board furniture but never the band', () => {
  assert.equal(
    normalizeTitleForCompare('Staff Software Engineer - Easy Apply'),
    'staff software engineer'
  );
  assert.equal(
    normalizeTitleForCompare('Staff Software Engineer (Remote, Full-Time)'),
    'staff software engineer'
  );
  assert.equal(normalizeTitleForCompare('  STAFF   Software  Engineer '), 'staff software engineer');
  // The band survives normalisation — it is the thing being compared.
  assert.match(normalizeTitleForCompare('Senior Software Engineer'), /^senior/);
});

test('the reported defect is caught: Staff posting, Senior resume', () => {
  const cmp = compareTitles('Staff Software Engineer', 'Senior Software Engineer');
  assert.equal(cmp.bandMismatch, true);
  assert.equal(cmp.clean, false);
  assert.equal(cmp.targetBand, 'staff');
  assert.equal(cmp.actualBand, 'senior');
  assert.match(cmp.detail, /Seniority band mismatch/);
});

test('an exact match is clean, including through board furniture', () => {
  let cmp = compareTitles('Staff Software Engineer', 'Staff Software Engineer');
  assert.equal(cmp.clean, true);
  assert.equal(cmp.detail, null);

  cmp = compareTitles('Staff Software Engineer - Easy Apply', 'Staff Software Engineer');
  assert.equal(cmp.clean, true, cmp.detail || '');
});

test('dropping the band entirely is a mismatch, not a near miss', () => {
  const cmp = compareTitles('Staff Software Engineer', 'Software Engineer');
  assert.equal(cmp.bandMismatch, true);
  assert.equal(cmp.actualBand, null);
});

test('inventing a band the posting never stated is a mismatch', () => {
  const cmp = compareTitles('Software Engineer', 'Senior Software Engineer');
  assert.equal(cmp.bandMismatch, true);
});

test('same band, different wording is flagged but not a band error', () => {
  const cmp = compareTitles('Staff Software Engineer', 'Staff Backend Engineer');
  assert.equal(cmp.bandMismatch, false);
  assert.equal(cmp.normalizedEqual, false);
  assert.equal(cmp.clean, false);
  assert.match(cmp.detail, /wording differs/);
});

test('an empty title is reported as unmeasurable rather than as a pass', () => {
  const cmp = compareTitles('', 'Senior Software Engineer');
  assert.equal(cmp.target, null);
  assert.match(cmp.detail, /could not be verified/);
});

test('an empty resume title against a real posting is a mismatch', () => {
  const cmp = compareTitles('Staff Software Engineer', '');
  assert.equal(cmp.clean, false);
  assert.equal(cmp.actual, null);
});

// ── Headline: the role, not the employer's org chart ────────────────────────
const { headlineFromPostingTitle } = require('./titleMatch');

test('the reported defect: a team name is not a job title', () => {
  // "Agentic Runtime" is Glean's team. The candidate does not hold a title
  // with another company's team name in it.
  assert.equal(headlineFromPostingTitle('Software Engineer, Agentic Runtime'), 'Software Engineer');
  assert.equal(headlineFromPostingTitle('Staff Software Engineer, Platform Infrastructure'), 'Staff Software Engineer');
  assert.equal(headlineFromPostingTitle('Software Engineer, Extensibility Platform'), 'Software Engineer');
});

test('the seniority band and level survive', () => {
  assert.equal(headlineFromPostingTitle('Staff Engineer: Infrastructure'), 'Staff Engineer');
  assert.equal(headlineFromPostingTitle('Software Engineer II'), 'Software Engineer II');
  assert.equal(headlineFromPostingTitle('Senior Software Engineer (L5)'), 'Senior Software Engineer');
});

test('board furniture and posting qualifiers are dropped', () => {
  assert.equal(headlineFromPostingTitle('Staff Software Engineer - Easy Apply'), 'Staff Software Engineer');
  assert.equal(headlineFromPostingTitle('Senior Software Engineer - Payments (Remote)'), 'Senior Software Engineer');
  assert.equal(headlineFromPostingTitle('Product Designer | Growth'), 'Product Designer');
});

test('a title that is all role is left exactly as written', () => {
  assert.equal(headlineFromPostingTitle('Senior Full Stack Software Engineer'), 'Senior Full Stack Software Engineer');
  assert.equal(headlineFromPostingTitle('Developer Advocate'), 'Developer Advocate');
  assert.equal(headlineFromPostingTitle('Engineering Manager'), 'Engineering Manager');
});

test('when the head is not recognisably a role, nothing is cut', () => {
  // Better to keep a suffix than to guess a role wrong.
  assert.equal(headlineFromPostingTitle('Head of Platform, EMEA'), 'Head of Platform, EMEA');
  assert.equal(headlineFromPostingTitle(''), '');
  assert.equal(headlineFromPostingTitle(null), '');
});
