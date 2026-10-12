const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  isValidRequirement,
  reconcileRequirementCoverage,
  requirementGapNote,
} = require('./jobRequirements');

test('the requirements the old skill filter threw away now survive', () => {
  // Each of these was rejected by isValidSkill — too many words, or mentions
  // years — and so never reached the prompt. They are the lines that separate
  // a Staff posting from a Senior one.
  const kept = [
    '8+ years of professional software engineering experience',
    'own the architecture of a multi-team platform',
    'mentor senior engineers and drive technical direction',
    'experience operating services in regulated fintech environments',
    'lead design reviews across several teams',
  ];
  for (const r of kept) {
    assert.equal(isValidRequirement(r), true, `rejected: ${r}`);
  }
});

test('boilerplate is not a requirement', () => {
  const dropped = [
    'We are an equal opportunity employer',
    'Competitive salary range and bonus',
    'Comprehensive health insurance and dental',
    '401(k) matching up to 6%',
    'Generous paid time off policy',
    'About us: we are changing the world',
    'Apply now to join our team',
  ];
  for (const r of dropped) {
    assert.equal(isValidRequirement(r), false, `kept boilerplate: ${r}`);
  }
});

test('a pasted paragraph is not one requirement', () => {
  assert.equal(isValidRequirement('word '.repeat(40)), false);
  assert.equal(isValidRequirement('x'.repeat(250)), false);
});

test('fragments too short to mean anything are rejected', () => {
  assert.equal(isValidRequirement('Go'), false);
  assert.equal(isValidRequirement('leadership'), false); // single word
  assert.equal(isValidRequirement(''), false);
  assert.equal(isValidRequirement(null), false);
  assert.equal(isValidRequirement(42), false);
});

// ── Reconciliation ──────────────────────────────────────────────────────────

const ASKED = [
  '8+ years of professional software engineering experience',
  'own the architecture of a multi-team platform',
  'mentor senior engineers and drive technical direction',
];

test('a requirement the model did not report is unassessed, never assumed met', () => {
  const result = reconcileRequirementCoverage(ASKED, [
    { requirement: ASKED[0], status: 'demonstrated', evidence: 'Role 1 bullets' },
  ]);
  assert.equal(result.total, 3);
  assert.equal(result.demonstratedCount, 1);
  assert.equal(result.unmet.length, 2);
  assert.deepEqual(
    result.unmet.map((u) => u.status),
    ['unassessed', 'unassessed']
  );
});

test('every unmet requirement reaches the gap report, whatever its status', () => {
  const result = reconcileRequirementCoverage(ASKED, [
    { requirement: ASKED[0], status: 'demonstrated' },
    { requirement: ASKED[1], status: 'partial', evidence: 'single-team ownership only' },
    { requirement: ASKED[2], status: 'missing' },
  ]);
  assert.equal(result.unmet.length, 2);
  assert.equal(result.unmet[0].status, 'partial');
  assert.equal(result.unmet[0].evidence, 'single-team ownership only');
  assert.equal(result.unmet[1].status, 'missing');
});

test('wording and case drift in the model’s echo still matches', () => {
  const result = reconcileRequirementCoverage(ASKED, [
    { requirement: '  Own the Architecture of a Multi-Team Platform  ', status: 'demonstrated' },
  ]);
  const owned = result.coverage.find((c) => c.requirement === ASKED[1]);
  assert.equal(owned.status, 'demonstrated');
});

test('an invented status is treated as unassessed, not as a pass', () => {
  const result = reconcileRequirementCoverage(ASKED, [
    { requirement: ASKED[0], status: 'mostly fine' },
    { requirement: ASKED[1], status: 'YES' },
  ]);
  assert.equal(result.demonstratedCount, 0);
  assert.equal(result.unmet.length, 3);
});

test('a status for a requirement nobody asked about is ignored', () => {
  const result = reconcileRequirementCoverage(ASKED, [
    { requirement: 'something the model made up entirely', status: 'demonstrated' },
  ]);
  assert.equal(result.total, 3);
  assert.equal(result.demonstratedCount, 0);
  assert.ok(!result.coverage.some((c) => /made up/.test(c.requirement)));
});

test('duplicate requirements collapse to one row', () => {
  const result = reconcileRequirementCoverage([ASKED[0], ASKED[0]], [
    { requirement: ASKED[0], status: 'demonstrated' },
  ]);
  assert.equal(result.total, 1);
});

test('reconciliation survives junk input', () => {
  assert.equal(reconcileRequirementCoverage(null, null).total, 0);
  assert.equal(reconcileRequirementCoverage(ASKED, 'not an array').unmet.length, 3);
  assert.equal(reconcileRequirementCoverage(ASKED, [null, {}, { status: 'demonstrated' }]).demonstratedCount, 0);
});

test('the gap note distinguishes partial from missing from unassessed', () => {
  assert.match(requirementGapNote('partial'), /partially/i);
  assert.match(requirementGapNote('unassessed'), /not assessed/i);
  assert.match(requirementGapNote('missing'), /does not demonstrate/i);
});
