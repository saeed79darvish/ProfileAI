import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LADDER,
  emptyDraft,
  getChips,
  matchSector,
  matchChip,
  parseSkillList,
  normalizeSkill,
  needsAI,
  shouldSkip,
  nextStepIndex,
  isAlreadyAnswered,
  mergeInterpreted,
  attachBullets,
  seedFromImport,
  buildTitle,
  draftToResumeData,
  draftToProfileShape,
  panelState,
} from './coachLogic.js';
import { computeProfileCompletion } from '../../hooks/useProfileCompletion.js';

const step = (id) => LADDER.find((s) => s.id === id);

// ── Ladder integrity ────────────────────────────────────────────────────────

test('every ladder step declares the fields the page dispatches on', () => {
  for (const s of LADDER) {
    assert.ok(s.id, 'step needs an id');
    assert.ok(s.question, `${s.id} needs a question`);
    assert.ok(['chips', 'multi', 'text', 'branch'].includes(s.kind), `${s.id} has kind ${s.kind}`);
    // A step must be answerable somehow, or the conversation dead-ends.
    assert.ok(s.chipSet || s.freeText, `${s.id} accepts neither chips nor text`);
  }
});

test('no ladder step can strand a signed-out visitor', () => {
  // Typing prose costs an AI call, which guests do not have. Every step must
  // therefore offer chips, a free-text path that needs no model, or a skip —
  // otherwise a guest reaches it and the conversation dead-ends.
  const stuck = LADDER.filter((s) => {
    const hasChips = !!s.chipSet;
    const localText = s.freeText && !s.aiStep;
    return !hasChips && !localText && !s.optional;
  });
  assert.deepEqual(stuck.map((s) => s.id), [], 'these steps have no guest-reachable answer');
});

test('every chipSet a step names resolves to real chips', () => {
  const draft = { ...emptyDraft(), sector: 'tech' };
  for (const s of LADDER) {
    if (!s.chipSet) continue;
    const chips = getChips(s, draft);
    assert.ok(chips.length > 0, `${s.id} chipSet "${s.chipSet}" resolved empty`);
    for (const c of chips) {
      assert.ok(c.id && c.label, `${s.id} produced a malformed chip`);
    }
  }
});

test('an unknown sector still yields skill chips rather than an empty row', () => {
  const chips = getChips(step('skills'), { sector: 'not-a-sector' });
  assert.ok(chips.length > 0);
});

test('skill chips are de-duplicated across category headings', () => {
  const chips = getChips(step('skills'), { sector: 'product' });
  const labels = chips.map((c) => c.label);
  assert.equal(labels.length, new Set(labels).size);
});

// ── Local matching: the no-AI path ──────────────────────────────────────────

test('matchSector resolves the Figma quick-replies without the model', () => {
  assert.equal(matchSector('I work in design').sector, 'design');
  assert.equal(matchSector("I'm a software engineer").sector, 'tech');
  assert.equal(matchSector('marketing').sector, 'marketing');
});

test('matchSector returns null for something genuinely unrecognisable', () => {
  assert.equal(matchSector('i mostly wrangle alpacas'), null);
  assert.equal(matchSector(''), null);
});

test('matchChip needs an exact or substantial match, never a loose guess', () => {
  const chips = [{ id: 'ic', label: 'Individual Contributor' }, { id: 'manager', label: 'Manager' }];
  assert.equal(matchChip('Manager', chips).id, 'manager');
  assert.equal(matchChip('manager', chips).id, 'manager');
  // Two characters must not be allowed to select a chip.
  assert.equal(matchChip('an', chips), null);
});

test('parseSkillList splits the separators people actually type', () => {
  assert.deepEqual(parseSkillList('React, Node and PostgreSQL'), ['React', 'Node', 'PostgreSQL']);
  assert.deepEqual(parseSkillList('Figma / Sketch'), ['Figma', 'Sketch']);
  assert.deepEqual(parseSkillList('SQL; Python\nTableau'), ['SQL', 'Python', 'Tableau']);
  // Typed lowercase should not end up displayed lowercase.
  assert.deepEqual(parseSkillList('excel, route planning'), ['Excel', 'Route Planning']);
});

test('normalizeSkill fixes casing without mangling skills that own theirs', () => {
  assert.equal(normalizeSkill('excel'), 'Excel');
  assert.equal(normalizeSkill('vendor negotiation'), 'Vendor Negotiation');
  // Mixed case is deliberate — leave it exactly as written.
  assert.equal(normalizeSkill('iOS'), 'iOS');
  assert.equal(normalizeSkill('PostgreSQL'), 'PostgreSQL');
  assert.equal(normalizeSkill('.NET'), '.NET');
  assert.equal(normalizeSkill('  '), '');
});

test('needsAI is false wherever a guest can be served locally', () => {
  const draft = { ...emptyDraft(), sector: 'tech' };
  // No aiStep declared — a typed job title is already the answer.
  assert.equal(needsAI(step('title'), 'Staff Platform Engineer', draft), false);
  // Recognised sector phrasing.
  assert.equal(needsAI(step('sector'), 'I work in design', draft), false);
  // A skills list that split cleanly.
  assert.equal(needsAI(step('skills'), 'React, Go', draft), false);
  // Empty input never calls anything.
  assert.equal(needsAI(step('location'), '   ', draft), false);
});

test('needsAI is true only for genuinely unstructured answers', () => {
  const draft = { ...emptyDraft(), sector: 'tech' };
  assert.equal(needsAI(step('sector'), 'i mostly wrangle alpacas', draft), true);
  assert.equal(needsAI(step('currentRole'), 'Acme, about three years, until last spring', draft), true);
});

// ── Ladder navigation ───────────────────────────────────────────────────────

test('new grads skip the work-history questions', () => {
  const draft = { ...emptyDraft(), careerStage: 'new_grad' };
  assert.equal(shouldSkip(step('currentRole'), draft), true);
  assert.equal(shouldSkip(step('achievements'), draft), true);
  // Someone with a work history still gets asked.
  assert.equal(shouldSkip(step('currentRole'), { ...emptyDraft(), careerStage: 'experienced' }), false);
});

test('nextStepIndex walks over skipped steps and ends at -1', () => {
  const draft = { ...emptyDraft(), careerStage: 'new_grad' };
  const roleIdx = LADDER.findIndex((s) => s.id === 'currentRole');
  const next = nextStepIndex(roleIdx - 1, draft);
  assert.equal(LADDER[next].id, 'skills', 'should jump past currentRole and achievements');
  assert.equal(nextStepIndex(LADDER.length - 1, draft), -1);
});

test('an import stops the coach re-asking what it already answered', () => {
  const imported = {
    ...emptyDraft(),
    importedFrom: 'resume',
    title: 'Product Manager',
    skills: ['Roadmapping'],
    experience: [{ company: 'Acme', title: 'PM', startDate: '2020' }],
    education: [{ institution: 'State', degree: 'BSc' }],
    location: 'Berlin',
  };
  for (const id of ['title', 'currentRole', 'achievements', 'skills', 'education', 'location']) {
    assert.equal(isAlreadyAnswered(step(id), imported), true, `${id} should be considered answered`);
  }
  // Preferences can't come from a resume, so they're always still asked.
  assert.equal(isAlreadyAnswered(step('lookingFor'), imported), false);
  assert.equal(isAlreadyAnswered(step('workStyle'), imported), false);
  // Without an import nothing is pre-answered.
  assert.equal(isAlreadyAnswered(step('title'), { ...emptyDraft(), title: 'PM' }), false);
});

// ── Draft assembly ──────────────────────────────────────────────────────────

test('mergeInterpreted builds an experience row and flags an ongoing one', () => {
  const out = mergeInterpreted(emptyDraft(), 'currentRole', {
    title: 'Ops Lead', company: 'Acme', startDate: '2022-03',
  });
  assert.equal(out.experience.length, 1);
  assert.equal(out.experience[0].company, 'Acme');
  // No end date given → still there.
  assert.equal(out.experience[0].current, true);
  // Fills the headline when the conversation hadn't captured one yet.
  assert.equal(out.title, 'Ops Lead');
});

test('mergeInterpreted respects an explicit end date', () => {
  const out = mergeInterpreted(emptyDraft(), 'currentRole', {
    company: 'Acme', startDate: '2019', endDate: '2021-08',
  });
  assert.equal(out.experience[0].current, false);
});

test('mergeInterpreted unions skills instead of replacing them', () => {
  const draft = { ...emptyDraft(), skills: ['React'] };
  const out = mergeInterpreted(draft, 'skills', { skills: ['React', 'Go'] });
  assert.deepEqual(out.skills, ['React', 'Go']);
});

test('mergeInterpreted normalises the casing the model returns', () => {
  const out = mergeInterpreted(emptyDraft(), 'skills', { skills: ['route planning', 'excel'] });
  assert.deepEqual(out.skills, ['Route Planning', 'Excel']);
});

test('attachBullets writes onto the most recent role, with a raw-text fallback', () => {
  const draft = { ...emptyDraft(), experience: [{ company: 'Acme', description: '' }] };
  const withBullets = attachBullets(draft, ['Shipped the billing rewrite']);
  assert.match(withBullets.experience[0].description, /^• Shipped/);

  // The model returning nothing must not lose what the person said.
  const fallback = attachBullets(draft, [], 'i rebuilt the billing thing');
  assert.equal(fallback.experience[0].description, 'i rebuilt the billing thing');

  // No role to attach to → unchanged, not a crash.
  assert.deepEqual(attachBullets(emptyDraft(), ['x']), emptyDraft());
});

test('seedFromImport never clobbers an answer already given by hand', () => {
  const draft = { ...emptyDraft(), title: 'What I Said', skills: ['Mine'] };
  const out = seedFromImport(draft, { title: 'From Resume', skills: ['Parsed'], location: 'Berlin' });
  assert.equal(out.title, 'What I Said');
  assert.deepEqual(out.skills, ['Mine']);
  // But it does fill what was still empty.
  assert.equal(out.location, 'Berlin');
  assert.equal(out.importedFrom, 'resume');
});

// ── Handoff to the editor ───────────────────────────────────────────────────

test('buildTitle folds the level in without producing nonsense titles', () => {
  assert.equal(buildTitle({ title: 'Frontend Developer', level: 'ic' }), 'Frontend Developer');
  assert.equal(buildTitle({ title: 'Designer', level: 'lead' }), 'Lead Designer');
  assert.equal(buildTitle({ title: 'Designer', level: 'manager' }), 'Designer (Manager)');
  // "Product Manager" already says Manager — appending it again reads badly.
  assert.equal(buildTitle({ title: 'Product Manager', level: 'manager' }), 'Product Manager');
  // Never doubles a rank the title already carries.
  assert.equal(buildTitle({ title: 'Lead Designer', level: 'lead' }), 'Lead Designer');
  assert.equal(buildTitle({ title: '', level: 'lead' }), '');
});

test('draftToResumeData matches what ProfileForm reads from location.state', () => {
  const draft = {
    ...emptyDraft(),
    title: 'Product Manager',
    level: 'ic',
    location: 'Berlin',
    roleTypes: ['full-time'],
    skills: ['Roadmapping'],
    experience: [{ title: 'PM', company: 'Acme', startDate: '2022-01', current: true, description: '• Shipped' }],
    education: [{ institution: 'State', degree: 'BSc' }],
    projects: [{ title: 'Side thing', description: 'A thing', url: 'https://github.com/me/x' }],
  };
  const out = draftToResumeData(draft);

  assert.ok(Array.isArray(out.skills), 'skills hand off as a flat array');
  // The editor keys its ongoing-role pill off this sentinel.
  assert.equal(out.experience[0].endDate, 'Present');
  assert.equal(out.experience[0].employmentType, 'Full-time');
  // Project URL routing is inherited from the wizard's mapper.
  assert.equal(out.projects[0].githubUrl, 'https://github.com/me/x');
  assert.equal(out.projects[0].url, '');
});

test('the coach meter agrees with the canonical rubric', () => {
  const draft = {
    ...emptyDraft(),
    title: 'Product Manager',
    location: 'Berlin',
    skills: ['Roadmapping'],
    experience: [{ title: 'PM', company: 'Acme', startDate: '2022-01' }],
    education: [{ institution: 'State', degree: 'BSc' }],
  };
  const result = computeProfileCompletion(draftToProfileShape(draft));
  assert.ok(result.pct > 0 && result.pct < 100, 'a coach-only draft is neither empty nor complete');

  const panel = panelState(draft, result.items);
  assert.equal(panel.title, true);
  assert.equal(panel.skills, true);
  assert.equal(panel.exp, true);
  assert.equal(panel.edu, true);
  // Preferences aren't part of the shared rubric, so the panel scores them.
  assert.equal(panel.lookingFor, false);
  assert.equal(panelState({ ...draft, workStyle: 'remote' }, result.items).lookingFor, true);
});

test('an empty draft scores 0 and hands off without throwing', () => {
  assert.equal(computeProfileCompletion(draftToProfileShape(emptyDraft())).pct, 0);
  const out = draftToResumeData(emptyDraft());
  assert.deepEqual(out.skills, []);
  assert.deepEqual(out.experience, []);
});
