const { test } = require('node:test');
const assert = require('node:assert/strict');
const { swapLeadingTitle, buildTailoredSummary, enforceFoundationBullets, mergeEducation } = require('./foundation');

const ORIGINAL = 'Senior Software Engineer with 8+ years of experience leading frontend architecture and building scalable React and TypeScript applications for enterprise SaaS platforms. Deep expertise in component systems, state management, frontend performance optimization, and full-stack product development.';

test('the candidate\'s example: title swapped, everything else verbatim', () => {
  const out = swapLeadingTitle(ORIGINAL, 'Staff Software Engineer');
  assert.ok(out.startsWith('Staff Software Engineer with 8+ years of experience leading frontend architecture'));
  assert.equal(out.slice('Staff Software Engineer'.length), ORIGINAL.slice('Senior Software Engineer'.length));
});

test('a summary that does not open with a title is left untouched', () => {
  const s = 'Builds UI platforms that product teams ship on.';
  assert.equal(swapLeadingTitle(s, 'Staff Software Engineer'), s);
});

test('the addition is appended after the foundation, never in place of it', () => {
  const { summary, foundation, addition, titleSwapped } = buildTailoredSummary({
    originalSummary: ORIGINAL, headline: 'Staff Software Engineer',
    addition: 'Recent work has centred on billing and subscription features across several product teams.',
  });
  assert.ok(summary.startsWith(foundation));
  assert.ok(summary.endsWith(addition));
  assert.equal(titleSwapped, true);
  assert.match(summary, /8\+ years/, 'the candidate\'s own figure was removed');
});

test('an addition is capped at two sentences and cannot repeat the foundation', () => {
  const { addition } = buildTailoredSummary({
    originalSummary: ORIGINAL, headline: 'Staff Software Engineer',
    addition: 'Deep expertise in component systems, state management, frontend performance optimization, and full-stack product development. One. Two. Three.',
  });
  assert.equal(addition, 'One. Two.');
});

test('no stored summary: nothing is fabricated', () => {
  const { summary, foundation } = buildTailoredSummary({ originalSummary: '', headline: 'X', addition: 'Added.' });
  assert.equal(foundation, '');
  assert.equal(summary, 'Added.');
});

// ── bullets ──
const SRC = [{ company: 'Equinix', description: '• Architected the AI component library behind the Equinix Fabric platform, used by 20+ internal applications and cutting development time by 50%\n• Mentor junior engineers on frontend platform work and on API design for component libraries' }];

test('a bullet rewritten in the model\'s words is restored verbatim', () => {
  const d = { experience: [{ company: 'Equinix', description: '• Defined the frontend architecture for enterprise billing systems\n• Mentor junior engineers on frontend platform work and on API design for component libraries' }] };
  const { restored } = enforceFoundationBullets(d, SRC);
  assert.equal(restored.length, 1);
  assert.match(d.experience[0].description, /Equinix Fabric platform, used by 20\+ internal applications and cutting development time by 50%/);
  // The model's unrelated line survives as an addition, after the originals.
  assert.match(d.experience[0].description, /enterprise billing systems$/);
});

test('light keyword surfacing is accepted; a dropped number is not', () => {
  const surfaced = { experience: [{ company: 'Equinix', description: '• Architected the AI component library behind the Equinix Fabric platform in React and TypeScript, used by 20+ internal applications and cutting development time by 50%\n• Mentor junior engineers on frontend platform work and on API design for component libraries' }] };
  assert.deepEqual(enforceFoundationBullets(surfaced, SRC).restored, []);
  const dropped = { experience: [{ company: 'Equinix', description: '• Architected the AI component library behind the Equinix Fabric platform, used by 20+ internal applications\n• Mentor junior engineers on frontend platform work and on API design for component libraries' }] };
  assert.equal(enforceFoundationBullets(dropped, SRC).restored.length, 1);
  assert.match(dropped.experience[0].description, /50%/);
});

test('reordering within a role is allowed', () => {
  const d = { experience: [{ company: 'Equinix', description: '• Mentor junior engineers on frontend platform work and on API design for component libraries\n• Architected the AI component library behind the Equinix Fabric platform, used by 20+ internal applications and cutting development time by 50%' }] };
  assert.deepEqual(enforceFoundationBullets(d, SRC).restored, []);
});

test('a role the model dropped comes back whole', () => {
  const d = { experience: [] };
  enforceFoundationBullets(d, SRC);
  assert.equal(d.experience.length, 1);
  assert.match(d.experience[0].description, /20\+ internal applications/);
});

// ── education ──
test('the reported defect: "Bootcamp" loses to the real institution', () => {
  const out = mergeEducation(
    [{ institution: 'Bootcamp', degree: 'Software Engineering Bootcamp', fieldOfStudy: 'Software Engineering' }],
    [{ school: 'UCSC Silicon Valley Extension', degree: 'Full Stack Development Certificate', year: '2018' }]
  );
  assert.equal(out[0].school, 'UCSC Silicon Valley Extension');
  assert.equal(out[0].year, '2018');
  assert.equal(out[0].field, 'Software Engineering');
});

test('a real institution in the record is never replaced by a generic one', () => {
  const out = mergeEducation([{ school: 'MIT', degree: 'BSc', year: '2010' }], [{ school: 'University', degree: 'BSc' }]);
  assert.equal(out[0].school, 'MIT');
});
