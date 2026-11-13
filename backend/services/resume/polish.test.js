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
      { text: 'Reworked the design strategy, resulting in a 25% increase in user engagement.', from: [1] },
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
    bullets: [{ text: 'Reworked the design strategy, resulting in a 25% increase in user engagement.', from: [1] }],
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

test('a source "resulting in" figure may not become a cause', () => {
  const r = polish.verifyRole({
    sourceUnits: SOURCE, allSourceText: ALL, limit: 5,
    bullets: [
      { text: 'Launched AWSTV, with a custom React and VideoJS video player.', from: [0] },
      { text: 'Raised user engagement 25% by reworking the design strategy.', from: [1] },
    ],
  });
  assert.equal(r.units, null);
  assert.match(r.reasons.join(' '), /into a cause/);
});

test('an outcome the source never states is rejected', () => {
  const r = polish.verifyRole({
    sourceUnits: SOURCE, allSourceText: ALL, limit: 5,
    bullets: [{ text: 'Launched AWSTV, with a custom React and VideoJS player that stays fast at scale.', from: [0] }],
  });
  assert.equal(r.units, null);
  assert.match(r.reasons.join(' '), /outcome the source never states/);
});

test('tidySkills puts GraphQL with data, not languages, and matches css3 to a posting that says CSS', () => {
  const g = polish.tidySkills(['JavaScript', 'GraphQL', 'MongoDB', 'CSS3', 'Jest', 'AWS', 'Git', 'Sass', 'React'], { jobDescription: 'Strong CSS and React.', cap: 4 });
  assert.ok(!(g.Languages || []).includes('GraphQL'));
  assert.ok((g['APIs and data'] || []).includes('GraphQL'), JSON.stringify(g));
  assert.ok(Object.values(g).flat().includes('CSS3'), JSON.stringify(g));
  assert.ok(Object.values(g).flat().includes('React'));
});

// ── run(): write, verify, judge, repair ─────────────────────────────────────

const RUN_PROFILE = {
  summary: 'Frontend engineer.',
  title: 'Senior Software Engineer',
  skills: ['React', 'VideoJS'],
  experience: [
    { company: 'Amazon', title: 'Software Development Engineer', startDate: '2024-05-01', endDate: '2025-04-01',
      description: '• Launched the first version of AWSTV, featuring a custom React integration with VideoJS to deliver a scalable and performant video player.\n• Implemented browser- and OS-based video codec selection to ensure optimized playback performance on diverse platforms.' },
  ],
};
const good = JSON.stringify({
  summary: 'Builds React video players, from custom controls to codec selection. Launched AWSTV on a custom VideoJS integration.',
  experience: [{ index: 0, bullets: [
    { text: 'Launched the first version of AWSTV, integrating React with a custom VideoJS player.', from: [0] },
    { text: 'Added codec selection by browser and operating system so playback works across platforms.', from: [1] },
  ] }],
});
const bad = JSON.stringify({
  summary: 'Engineer with 8+ years building video players.',
  experience: [{ index: 0, bullets: [
    { text: 'Launched AWSTV for 1M+ users with a custom React player.', from: [0] },
    { text: 'Added codec selection by browser and operating system so playback works across platforms.', from: [1] },
  ] }],
});
const repairOnly = JSON.stringify({
  summary: 'Builds React video players, from custom controls to codec selection. Launched AWSTV on a custom VideoJS integration.',
  experience: [{ index: 0, bullets: [
    { text: 'Launched the first version of AWSTV, integrating React with a custom VideoJS player.', from: [0] },
    { text: 'Added codec selection by browser and operating system so playback works across platforms.', from: [1] },
  ] }],
});

test('run: a failed first answer is repaired once, with the reasons in the prompt', async () => {
  const prompts = [];
  const answers = [bad, repairOnly];
  const out = await polish.run({
    profile: RUN_PROFILE, jobDescription: 'Build video products.', targetTitle: 'Video Engineer', keywords: {},
    ask: async (p) => { prompts.push(p); return answers.shift(); },
    canRetry: () => true,
  });
  assert.equal(out.repaired, true);
  assert.ok(/new number 1/.test(prompts[1]) && /years-of-experience/.test(prompts[1]), 'repair prompt names the rejections');
  assert.ok(Array.isArray(out.verdict.roles[0].units));
  assert.ok(out.verdict.summary);
});

test('run: no repair when the clock does not allow it, so the failure stands', async () => {
  const out = await polish.run({
    profile: RUN_PROFILE, jobDescription: 'Build video products.', targetTitle: 'Video Engineer', keywords: {},
    ask: async () => bad, canRetry: () => false,
  });
  assert.equal(out.repaired, false);
  assert.equal(out.verdict.roles[0].units, null);
  assert.equal(out.verdict.summary, null);
});

test('run: the fast judge can send an otherwise valid bullet back for repair', async () => {
  const prompts = [];
  const answers = [good, repairOnly];
  const out = await polish.run({
    profile: RUN_PROFILE, jobDescription: 'Build video products.', targetTitle: 'Video Engineer', keywords: {},
    ask: async (p) => { prompts.push(p); return answers.shift(); },
    askFast: async () => JSON.stringify({ roles: [{ index: 0, unsupported: ['so playback works across platforms'] }], summary: [] }),
    canRetry: () => true,
  });
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /claim not supported by the source/);
  assert.ok(Array.isArray(out.verdict.roles[0].units));
});

test('run: a clean first answer needs no repair', async () => {
  let calls = 0;
  const out = await polish.run({
    profile: RUN_PROFILE, jobDescription: 'Build video products.', targetTitle: 'Video Engineer', keywords: {},
    ask: async () => { calls++; return good; },
    askFast: async () => JSON.stringify({ roles: [], summary: [] }),
    canRetry: () => true,
  });
  assert.equal(calls, 1);
  assert.equal(out.repaired, false);
  assert.ok(out.verdict.summary);
});
