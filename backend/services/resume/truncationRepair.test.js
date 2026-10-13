/**
 * Truncation recovery, exercised at EVERY cut point rather than a handful.
 *
 * A real tailoring run ended on the candidate's phone with:
 *   "Tailoring returned JSON that could not be parsed or repaired (16518
 *    chars): Unterminated string in JSON at position 16518"
 * The reply had run past max_tokens, which is expected and was meant to be
 * survivable. It was not, because the repair failed whenever the cut landed
 * inside the value of an object's FIRST key: rolling back out of the open
 * string left `{"company"`, and the dangling-key cleanup only handled a key
 * preceded by a comma. `company` is the first key of every experience entry,
 * so the failure was common, not exotic. Measured against a real tailored
 * resume, 49 of 589 sampled cut points were unrecoverable.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { repairTruncatedJSON } = require('../resumeParserService');

/** Shaped like the tailoring output contract, field order included. */
const DRAFT = {
  jobTitle: 'Software Engineer, Extensibility Platform',
  company: 'Benchling',
  title: 'Software Engineer, Extensibility Platform',
  summary: 'Built the component platform twenty internal applications at Equinix depend on.',
  skills: { Languages: ['TypeScript', 'JavaScript'], Frameworks: ['React', 'Node.js', 'Express'] },
  experience: [
    { company: 'Equinix', title: 'Senior UI Software Architect Engineer', period: 'Apr 2025 - Present', description: '• Architected the component library\n• Mentored engineers on API design' },
    { company: 'Amazon AWS', title: 'Lead UI Software Development Engineer', period: 'May 2024 - Apr 2025', description: '• Built the Video Player UI for 1M+ users a month' },
    { company: 'Autodesk', title: 'Software Engineer III', period: 'Jun 2021 - Aug 2023', description: '• Wrote RESTful and GraphQL APIs in Node.js and Express' },
  ],
  education: [{ school: 'UCSC Silicon Valley Extension', degree: 'Certificate', field: 'Software Engineering', year: '2018' }],
  projects: [],
  matchScore: 71,
  requirementCoverage: [
    { requirement: '2+ years of experience in a fulltime software engineering role', status: 'demonstrated', evidence: 'Six years across seven roles' },
    { requirement: 'Proficiency in backend development, API design, data management', status: 'partial', evidence: 'REST and GraphQL APIs at Autodesk' },
  ],
  matchAnalysis: {
    keywordMatch: '6 of 9',
    titleMatch: 'Close',
    gaps: ['Event and webhook systems: no evidence', 'Life sciences: interest only'],
    locationFlag: null,
    hybrid: true,
    delta: -12.5,
  },
  changelog: [{ section: 'summary', action: 'rewritten', detail: 'Led with scale' }],
};

for (const indent of [2, 0]) {
  test(`every cut point after the first complete value is recoverable (indent ${indent})`, () => {
    const full = JSON.stringify(DRAFT, null, indent);
    // A cut inside the very first key has nothing complete to keep, and null
    // is the right answer there. Everything after the first finished value
    // must come back as a usable object.
    const firstComplete = full.indexOf('",') + 1;
    const failures = [];
    for (let cut = firstComplete; cut < full.length; cut++) {
      if (!repairTruncatedJSON(full.slice(0, cut))) failures.push(cut);
    }
    assert.deepEqual(
      failures.slice(0, 5).map((c) => JSON.stringify(full.slice(Math.max(0, c - 25), c))),
      [],
      `${failures.length} of ${full.length - firstComplete} cut points were unrecoverable`
    );
  });
}

test('the reported case: a cut inside the first key of an object', () => {
  const full = JSON.stringify(DRAFT, null, 2);
  const at = full.indexOf('"company": "Autodesk"') + '"company": "Auto'.length;
  const r = repairTruncatedJSON(full.slice(0, at));
  assert.ok(r, 'unrecoverable');
  // The completed roles before the cut survive intact.
  assert.equal(r.experience[0].company, 'Equinix');
  assert.equal(r.experience[1].company, 'Amazon AWS');
});

test('a cut inside a bare literal or number', () => {
  const full = JSON.stringify(DRAFT, null, 2);
  for (const marker of ['"locationFlag": nu', '"hybrid": tr', '"delta": -1', '"delta": -12.']) {
    const at = full.indexOf(marker.split(':')[0]) + marker.length;
    assert.ok(repairTruncatedJSON(full.slice(0, at)), `failed after ${JSON.stringify(marker)}`);
  }
});

test('a cut late in the reply keeps the whole resume', () => {
  const full = JSON.stringify(DRAFT, null, 2);
  const at = full.indexOf('requirementCoverage') + 60;
  const r = repairTruncatedJSON(full.slice(0, at));
  assert.equal(r.summary, DRAFT.summary);
  assert.equal(r.experience.length, 3);
  assert.equal(r.education[0].school, 'UCSC Silicon Valley Extension');
});

test('a complete reply is returned unchanged', () => {
  assert.deepEqual(repairTruncatedJSON(JSON.stringify(DRAFT)), DRAFT);
});

test('nothing usable returns null rather than an empty shell', () => {
  assert.equal(repairTruncatedJSON(''), null);
  assert.equal(repairTruncatedJSON(null), null);
  assert.equal(repairTruncatedJSON('I cannot help with that'), null);
});
