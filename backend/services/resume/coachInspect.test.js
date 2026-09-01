const { test } = require('node:test');
const assert = require('node:assert/strict');

const { inspectProfile, bulletsOf, hasMetric } = require('./coachInspect');
const { titleTerms } = require('../coachMarket');

const codes = (profile) => inspectProfile(profile).findings.map((f) => f.code);

test('bulletsOf handles every shape a description is stored in', () => {
  assert.deepEqual(bulletsOf({ description: '• One\n• Two' }), ['One', 'Two']);
  assert.deepEqual(bulletsOf({ description: '- One\n* Two' }), ['One', 'Two']);
  assert.deepEqual(bulletsOf({ description: 'Just a paragraph' }), ['Just a paragraph']);
  assert.deepEqual(bulletsOf({ description: '' }), []);
  assert.deepEqual(bulletsOf({}), []);
});

test('hasMetric ignores years, which are dates rather than outcomes', () => {
  assert.equal(hasMetric('Cut errors by 30%'), true);
  assert.equal(hasMetric('Led a team of 12'), true);
  // A bare year must not count as evidence of impact.
  assert.equal(hasMetric('Joined the team in 2021'), false);
  assert.equal(hasMetric('Ran the dispatch desk'), false);
});

test('an empty profile reports the blockers and invents nothing else', () => {
  const found = codes({});
  assert.deepEqual(found.sort(), ['no_evidence', 'no_experience', 'no_skills', 'no_summary', 'no_title'].sort());
});

test('a role with no description is a blocker, named by where it is', () => {
  const report = inspectProfile({
    title: 'Ops', skills: ['A', 'B', 'C', 'D', 'E'],
    experience: [{ title: 'Coordinator', company: 'Acme', startDate: '2022', description: '' }],
  });
  const finding = report.findings.find((f) => f.code === 'role_no_bullets');
  assert.ok(finding, 'the empty role should be reported');
  assert.equal(finding.severity, 'blocker');
  assert.equal(finding.where, 'Coordinator at Acme');
});

test('a short bullet carrying a number is not treated as thin', () => {
  const withMetrics = inspectProfile({
    title: 'Ops', skills: ['A', 'B', 'C', 'D', 'E'],
    experience: [{ title: 'Ops', company: 'Acme', startDate: '2022', description: '• Cut errors 30%\n• Led 12 people' }],
  });
  assert.equal(withMetrics.findings.some((f) => f.code === 'thin_bullets'), false);
  assert.equal(withMetrics.counts.metricCoverage, 100);

  const vague = inspectProfile({
    title: 'Ops', skills: ['A', 'B', 'C', 'D', 'E'],
    experience: [{ title: 'Ops', company: 'Acme', startDate: '2022', description: '• Did reports\n• Helped out' }],
  });
  assert.ok(vague.findings.some((f) => f.code === 'thin_bullets'));
  assert.ok(vague.findings.some((f) => f.code === 'no_metrics'));
});

test('projects count as evidence when there is no work history', () => {
  const base = { title: 'Dev', skills: ['A', 'B', 'C', 'D', 'E'] };
  assert.ok(codes(base).includes('no_evidence'));
  assert.equal(codes({ ...base, projects: [{ title: 'A thing' }] }).includes('no_evidence'), false);
});

test('strengths are only claimed when they are true', () => {
  assert.deepEqual(inspectProfile({}).strengths, []);
  const strong = inspectProfile({
    title: 'Ops',
    experience: [
      { title: 'A', company: 'X', startDate: '2022', description: '• Cut errors 30%\n• Saved 12 hours a week' },
      { title: 'B', company: 'Y', startDate: '2020', description: '• Ran the desk' },
    ],
    skills: Array.from({ length: 10 }, (_, i) => `s${i}`),
    education: [{ institution: 'TU', degree: 'BSc' }],
  });
  assert.ok(strong.strengths.some((s) => /bullet points carry a real number/.test(s)));
  assert.ok(strong.strengths.includes('education is complete'));
});

// ── Market matching ─────────────────────────────────────────────────────────

test('titleTerms keeps the role noun, which is what makes a count mean something', () => {
  // Dropping "manager" here matched every posting containing "product".
  assert.deepEqual(titleTerms('Product Manager'), ['product', 'manager']);
  assert.deepEqual(titleTerms('Operations Manager'), ['operations', 'manager']);
});

test('titleTerms strips seniority and job-board furniture', () => {
  assert.deepEqual(titleTerms('Senior Frontend Engineer'), ['frontend', 'engineer']);
  assert.deepEqual(titleTerms('Sr. Payroll Specialist (Remote)'), ['payroll', 'specialist']);
});

test('titleTerms declines to match on a bare role noun', () => {
  // "Manager" alone describes half the corpus; a number from it would be
  // presented as if it said something about their target.
  assert.deepEqual(titleTerms('Manager'), []);
  assert.deepEqual(titleTerms('Engineer'), []);
  assert.deepEqual(titleTerms(''), []);
  // But a qualified one is fine.
  assert.deepEqual(titleTerms('Payroll Manager'), ['payroll', 'manager']);
});
