const { test } = require('node:test');
const assert = require('node:assert/strict');
const polish = require('./polish');

const SOURCE = [
  'Successfully launched the first version of AWSTV, featuring a custom React integration with VideoJS to deliver a scalable and performant video player.',
  'Improved user experience by implementing design strategies, resulting in a 25% increase in user engagement.',
];
const ALL = `${SOURCE.join(' ')} React VideoJS AWSTV Amazon`;

test('a faithful rewrite is accepted', () => {
  const r = polish.verifyRole({
    sourceUnits: SOURCE, allSourceText: ALL, limit: 5,
    bullets: [
      { text: 'Launched AWSTV, with a custom React and VideoJS video player.', from: [0] },
      { text: 'Raised user engagement 25% by reworking the design strategy.', from: [1] },
    ],
  });
  assert.equal(r.reasons.length, 0, r.reasons.join('; '));
  assert.equal(r.units.length, 2);
});

test('an invented number is rejected', () => {
  const r = polish.verifyRole({
    sourceUnits: SOURCE, allSourceText: ALL, limit: 5,
    bullets: [{ text: 'Launched AWSTV for 1M+ users with a custom React video player.', from: [0] }],
  });
  assert.equal(r.units, null);
  assert.match(r.reasons.join(' '), /new number/);
});

test('a real number is kept', () => {
  const r = polish.verifyRole({
    sourceUnits: SOURCE, allSourceText: ALL, limit: 5,
    bullets: [{ text: 'Raised user engagement 25% by reworking the design strategy.', from: [1] }],
  });
  assert.equal(r.reasons.length, 0, r.reasons.join('; '));
});

test('leadership the source never claims is rejected', () => {
  const r = polish.verifyRole({
    sourceUnits: SOURCE, allSourceText: ALL, limit: 5,
    bullets: [{ text: 'Led the AWSTV player architecture in React and VideoJS.', from: [0] }],
  });
  assert.equal(r.units, null);
  assert.match(r.reasons.join(' '), /leadership/);
});

test('a tool that is not in the resume is rejected', () => {
  const r = polish.verifyRole({
    sourceUnits: SOURCE, allSourceText: ALL, limit: 5,
    bullets: [{ text: 'Launched AWSTV with a React and Kubernetes video player.', from: [0] }],
  });
  assert.equal(r.units, null);
  assert.match(r.reasons.join(' '), /Kubernetes/);
});

test('padding past the source bullet count is rejected', () => {
  const b = { text: 'Launched AWSTV, with a custom React and VideoJS video player.', from: [0] };
  const r = polish.verifyRole({ sourceUnits: SOURCE, allSourceText: ALL, limit: 5, bullets: [b, b, b] });
  assert.equal(r.units, null);
});

test('a bullet with no cited source is rejected', () => {
  const r = polish.verifyRole({
    sourceUnits: SOURCE, allSourceText: ALL, limit: 5,
    bullets: [{ text: 'Launched AWSTV, with a custom React and VideoJS video player.' }],
  });
  assert.equal(r.units, null);
});

const EXP = [{ title: 'Software Engineer', company: 'Amazon', startDate: 'May 2024', endDate: 'June 2025', description: SOURCE.join('\n') }];

test('summary: years claims and new numbers are rejected, a clean one passes', () => {
  const base = { allSourceText: ALL, jobDescription: 'Build ad products for television.', experience: EXP, targetTitle: 'Software Engineer 5', heldTitles: ['software engineer'] };
  assert.ok(polish.verifySummary({ ...base, summary: 'Frontend engineer with 8+ years building React apps.' }).reasons.length);
  assert.ok(polish.verifySummary({ ...base, summary: 'Builds video players in React for 1M users.' }).reasons.length);
  const ok = polish.verifySummary({ ...base, summary: 'Builds React video players, from the controls to the search screens. Launched AWSTV on a custom VideoJS integration.' });
  assert.equal(ok.reasons.length, 0, ok.reasons.join('; '));
});

test('summary: opening with a title the candidate never held is rejected', () => {
  const r = polish.verifySummary({
    summary: 'Software Engineer 5 who builds React video players.',
    allSourceText: ALL, jobDescription: '', experience: EXP, targetTitle: 'Software Engineer 5', heldTitles: ['senior ui engineer'],
  });
  assert.match(r.reasons.join(' '), /title/);
});

test('tidySkills dedupes spellings, groups, caps and adds nothing', () => {
  const input = ['JavaScript (ES6+)', 'JavaScript', 'React', 'Redux', 'Docker', 'AWS', 'Jest', 'Sass'];
  const g = polish.tidySkills(input, { jobDescription: 'React and TypeScript', bulletText: '', cap: 6 });
  const flat = Object.values(g).flat();
  assert.equal(flat.length, 6);
  assert.equal(flat.filter((s) => /^javascript/i.test(s)).length, 1);
  assert.ok(flat.every((s) => input.includes(s)));
  assert.ok(g.Languages || g.Frameworks);
});

test('applyPolish leaves a failed role for the foundation guard', () => {
  const draft = { summary: 'old', experience: [{ company: 'Amazon', title: 'SWE', description: 'old' }] };
  const out = polish.applyPolish(draft, { experience: EXP }, { summary: null, summaryReasons: ['years'], roles: [{ units: null, reasons: ['new number 1M+'] }] });
  assert.equal(draft.experience[0].description, 'old');
  assert.equal(draft.summary, 'old');
  assert.equal(out.appliedRoles.length, 0);
  assert.equal(out.rejected.length, 2);
});

test('a rewrite that drops the role\'s real figure is rejected', () => {
  const r = polish.verifyRole({
    sourceUnits: SOURCE, allSourceText: ALL, limit: 5,
    bullets: [{ text: 'Reworked the design strategy to lift user engagement.', from: [1] }],
  });
  assert.equal(r.units, null);
  assert.match(r.reasons.join(' '), /25%/);
});
