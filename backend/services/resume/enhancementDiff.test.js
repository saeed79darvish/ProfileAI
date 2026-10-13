const { test } = require('node:test');
const assert = require('node:assert/strict');

const { diffSections, restoreUnselected, wordChangeRatio } = require('./enhancementDiff');
const { buildCandidateChoices, getDepartmentEnhancementPrompt } = require('./enhancementPrompts');

/** The candidate's profile before the enhancement that "changed nothing". */
const ORIGINAL = {
  title: 'Senior Software Engineer, Product Software | AI-Enabled UI Platforms & Engineering',
  summary: 'Senior Frontend Engineer specializing in React and modern JavaScript development with full-stack capabilities. Experienced in building responsive web applications using React, TypeScript, Next.js, Node.js, and AWS.',
  skills: ['Algorithms', 'TypeScript', 'Next.js', 'React', 'Node.js', 'GraphQL', 'AWS', 'Docker'],
  experience: [
    { company: 'Equinix', title: 'Architect', description: 'Built reusable AI components for the Equinix Fabric port domain.' },
    { company: 'Amazon AWS', title: 'Lead', description: 'Launched the first version of AWSTV with a custom React integration around VideoJS.' },
  ],
  projects: [],
};

// ── The reported defect ─────────────────────────────────────────────────────

test('an identical title is not reported as enhanced', () => {
  const enhanced = { ...ORIGINAL };
  assert.ok(diffSections(ORIGINAL, enhanced).unchanged.includes('title'));
});

test('the same skills in a different order are not a change', () => {
  const enhanced = { ...ORIGINAL, skills: [...ORIGINAL.skills].reverse() };
  const { changed } = diffSections(ORIGINAL, enhanced);
  assert.ok(!changed.includes('skills'), 'a reshuffle was presented as an enhancement');
});

test('a re-ordering of sentences is not a rewrite', () => {
  const [a, b] = ORIGINAL.summary.split('. ');
  const enhanced = { ...ORIGINAL, summary: `${b}. ${a}.` };
  assert.ok(!diffSections(ORIGINAL, enhanced).changed.includes('summary'));
});

test('a one-word tweak in a long summary does not count', () => {
  const enhanced = { ...ORIGINAL, summary: ORIGINAL.summary.replace('Experienced', 'Skilled') };
  assert.ok(wordChangeRatio(ORIGINAL.summary, enhanced.summary) < 0.08);
  assert.ok(!diffSections(ORIGINAL, enhanced).changed.includes('summary'));
});

test('nothing changed anywhere yields an empty change list', () => {
  const enhanced = JSON.parse(JSON.stringify(ORIGINAL));
  enhanced.skills.reverse();
  assert.deepEqual(diffSections(ORIGINAL, enhanced).changed, []);
});

// ── Real changes are still recognised ───────────────────────────────────────

test('a genuinely rewritten summary is a change', () => {
  const enhanced = {
    ...ORIGINAL,
    summary: 'Architect of the component platform twenty internal applications at Equinix are built on, and of the AWSTV video player serving AWS users at scale.',
  };
  assert.ok(diffSections(ORIGINAL, enhanced).changed.includes('summary'));
});

test('an added or removed skill is a change', () => {
  const enhanced = { ...ORIGINAL, skills: [...ORIGINAL.skills, 'Redux'] };
  assert.ok(diffSections(ORIGINAL, enhanced).changed.includes('skills'));
});

test('a rewritten bullet in one role makes experience a change', () => {
  const enhanced = JSON.parse(JSON.stringify(ORIGINAL));
  enhanced.experience[1].description = 'Shipped AWSTV v1: a React wrapper around VideoJS with per-browser codec selection and custom controls.';
  assert.ok(diffSections(ORIGINAL, enhanced).changed.includes('experience'));
});

test('a section the model did not return is neither changed nor unchanged', () => {
  const { changed, unchanged } = diffSections(ORIGINAL, { summary: ORIGINAL.summary });
  assert.ok(!changed.includes('title') && !unchanged.includes('title'));
});

// ── Section selection is enforced in code ───────────────────────────────────

test('sections the candidate did not select are restored exactly', () => {
  const enhanced = { ...ORIGINAL, title: 'Rewritten title', summary: 'Rewritten summary entirely different words here today now' };
  const restored = restoreUnselected(enhanced, ORIGINAL, ['summary']);
  assert.deepEqual(restored, ['title', 'skills', 'experience', 'projects']);
  assert.equal(enhanced.title, ORIGINAL.title);
  assert.notEqual(enhanced.summary, ORIGINAL.summary);
});

test('no selection means nothing is restored', () => {
  const enhanced = { ...ORIGINAL, title: 'x' };
  assert.deepEqual(restoreUnselected(enhanced, ORIGINAL, null), []);
  assert.equal(enhanced.title, 'x');
});

// ── The modal's choices reach the model as binding instructions ─────────────

test('choices are stated as binding, not as a closing suggestion', () => {
  const block = buildCandidateChoices({ targetRole: 'Staff Software Engineer', tone: 'executive', focus: ['scope'], sections: ['summary'] }, { years: 6.4 });
  assert.match(block, /binding/);
  assert.match(block, /Staff Software Engineer/);
  assert.match(block, /Rewrite ONLY these sections: summary/);
  assert.match(block, /about 6\.4 years/);
});

test('"add metrics" is asked honestly — surface, never invent', () => {
  const block = buildCandidateChoices({ focus: ['metrics'] });
  assert.match(block, /already in the candidate's history/);
  assert.match(block, /Never add a number/);
});

test('years come from the profile dates, never from a modal default', () => {
  // The modal sent "Experience level: 3-5 years" for everyone. It is no longer
  // an input at all; only the derived figure reaches the model.
  const block = buildCandidateChoices({ experienceLevel: '3-5', targetRole: 'Staff' }, { years: 6.4 });
  assert.ok(!/3.5 years/.test(block));
  assert.match(block, /6\.4 years/);
});

test('the enhancement prompt no longer prescribes the templated opener', () => {
  const { prompt } = getDepartmentEnhancementPrompt('engineering', ORIGINAL, '', { sections: ['summary'] }, { years: 6.4 });
  assert.match(prompt, /DO NOT USE A TEMPLATE/);
  assert.ok(!/- Sentence 1: \[Title\] with \[X\] years/.test(prompt), 'the old template instruction is still there');
  assert.match(prompt, /Scale IS allowed/);
});

test('older clients sending free text still work', () => {
  const { prompt } = getDepartmentEnhancementPrompt('engineering', ORIGINAL, 'Keep bullets short');
  assert.match(prompt, /Keep bullets short/);
});

test('every department group drops the template', () => {
  for (const group of Object.keys(require('./enhancementPrompts').ENHANCEMENT_PROMPT_MAP)) {
    const { prompt } = getDepartmentEnhancementPrompt(group, ORIGINAL, '', {}, {});
    assert.ok(!/- Sentence 1: \[Title\] with \[X\] years/.test(prompt), `${group} still prescribes the template`);
  }
});
