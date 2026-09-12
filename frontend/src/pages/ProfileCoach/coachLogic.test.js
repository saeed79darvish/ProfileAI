import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  JOB_SECTORS,
  SECTOR_TITLES,
  SECTOR_SKILLS,
} from '../../data/jobTaxonomy.js';

import {
  LADDER,
  levelsFor,
  parseLinks,
  targetChips,
  normalizeTitle,
  titleChips,
  CUSTOM_ANSWER_CHIP,
  sectorChips,
  MORE_SECTORS_CHIP,
  emptyDraft,
  resumeSections,
  isPresentable,
  canAnswer,
  getChips,
  matchSector,
  matchChip,
  parseSkillList,
  normalizeSkill,
  needsAI,
  shouldSkip,
  nextStepIndex,
  isAlreadyAnswered,
  applyToDraft,
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

// Steps that put a question to the person. The rest ('run', 'tour',
// 'convert') do work or show something and move on by themselves, so the
// answerability rules below do not apply to them.
const ASKING_KINDS = new Set(['chips', 'multi', 'text', 'branch']);
const asking = LADDER.filter((s) => ASKING_KINDS.has(s.kind));

test('every ladder step declares the fields the page dispatches on', () => {
  for (const s of LADDER) {
    assert.ok(s.id, 'step needs an id');
    assert.ok(s.question, `${s.id} needs a question`);
    assert.ok(
      [...ASKING_KINDS, 'run', 'tour', 'convert'].includes(s.kind),
      `${s.id} has unknown kind ${s.kind}`
    );
    // A 'run' step must say what it runs, or the page has nothing to dispatch.
    if (s.kind === 'run') assert.ok(s.runs, `${s.id} is a run step with no runs field`);
  }
});

test('every question step is answerable', () => {
  for (const s of asking) {
    assert.ok(s.chipSet || s.freeText, `${s.id} accepts neither chips nor text`);
  }
});

test('every question step can be answered without typing', () => {
  // Guests can type now (the account is asked for at the end), so this is no
  // longer about access — it is that a conversation which can only be
  // advanced by composing prose is miserable on a phone, and one unskippable
  // essay question is where people quit. Chips, a local free-text path, or a
  // skip: every step needs one of the three.
  const stuck = asking.filter((s) => {
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
  // Past the two employer questions, and onto projects — which is the whole
  // point: a new grad with no job still needs something in the section
  // recruiters read first.
  assert.equal(LADDER[next].id, 'projects');
  assert.equal(nextStepIndex(LADDER.length - 1, draft), -1);
});

test('projects are asked of whoever has nothing else, and nobody else', () => {
  const projectsIdx = LADDER.findIndex((s) => s.id === 'projects');
  const employed = {
    ...emptyDraft(),
    careerStage: 'experienced',
    experience: [{ company: 'Acme', title: 'Engineer' }],
  };
  assert.equal(shouldSkip(LADDER[projectsIdx], employed), true);

  // Skipping the role questions leaves the same hole a new grad has.
  const skipped = { ...emptyDraft(), careerStage: 'experienced' };
  assert.equal(shouldSkip(LADDER[projectsIdx], skipped), false);
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

// ── The coaching phases ─────────────────────────────────────────────────────

test('the review only runs when there is a document to react to', () => {
  const chatOnly = { ...emptyDraft(), title: 'PM' };
  assert.equal(shouldSkip(step('review'), chatOnly), true, 'nothing imported, nothing to review');
  assert.equal(shouldSkip(step('review'), { ...chatOnly, importedFrom: 'resume' }), false);
});

test('the target assessment is skipped rather than inventing a goal', () => {
  assert.equal(shouldSkip(step('assess'), emptyDraft()), true);
  assert.equal(shouldSkip(step('assess'), { ...emptyDraft(), target: 'Product Manager' }), false);
  // A whitespace answer is not a target.
  assert.equal(shouldSkip(step('assess'), { ...emptyDraft(), target: '   ' }), true);
});

test('target chips never offer the job they already have', () => {
  const chips = getChips(step('target'), { sector: 'tech', title: 'Frontend Developer' });
  assert.ok(chips.length > 0);
  assert.equal(chips.some((c) => c.label === 'Frontend Developer'), false);
});

test('the closing steps run in order and end the conversation', () => {
  const ids = LADDER.map((s) => s.id);
  const order = ['target', 'assess', 'build', 'tour', 'convert'];
  const positions = order.map((id) => ids.indexOf(id));
  positions.forEach((pos, i) => {
    assert.ok(pos > -1, `${order[i]} is missing from the ladder`);
    if (i > 0) assert.ok(pos > positions[i - 1], `${order[i]} must come after ${order[i - 1]}`);
  });
  assert.equal(ids[ids.length - 1], 'convert', 'the sign-up ask is the last thing that happens');
});

test('a probe answer lands on the role it was about, and keeps what was there', () => {
  const draft = {
    ...emptyDraft(),
    skills: ['Excel'],
    experience: [{ title: 'Ops', company: 'Acme', description: '• Ran dispatch' }],
  };
  const out = mergeInterpreted(draft, 'probe', {
    bullets: ['Rebuilt the weekly rota'],
    skills: ['sql'],
  });
  const lines = out.experience[0].description.split('\n');
  assert.equal(lines.length, 2, 'the existing bullet survives');
  assert.match(lines[1], /Rebuilt the weekly rota/);
  // Skills come back in the taxonomy's spelling, not as typed.
  assert.deepEqual(out.skills, ['Excel', 'SQL']);
});

test('a probe that evidences nothing changes nothing', () => {
  const draft = { ...emptyDraft(), experience: [{ title: 'Ops', description: '• Ran dispatch' }] };
  assert.deepEqual(mergeInterpreted(draft, 'probe', {}), draft);
});

test('a probe with no role to attach to still captures the skills', () => {
  const out = mergeInterpreted(emptyDraft(), 'probe', { bullets: ['Did a thing'], skills: ['figma'] });
  assert.deepEqual(out.experience, [], 'no role invented to hang the bullet on');
  assert.deepEqual(out.skills, ['Figma']);
});

test('normalizeSkill restores the taxonomy spelling before guessing', () => {
  assert.equal(normalizeSkill('sql'), 'SQL');
  assert.equal(normalizeSkill('postgresql'), 'PostgreSQL');
  assert.equal(normalizeSkill('a/b testing'), 'A/B Testing');
});

// ── The resume shown in the chat ────────────────────────────────────────────

test('resumeSections mirrors the real resume order and strips bullet marks', () => {
  const draft = {
    ...emptyDraft(),
    summary: 'Operations manager.',
    skills: ['Excel'],
    experience: [{ title: 'Ops', company: 'Acme', startDate: '2022', endDate: 'Present', description: '• Cut errors 30%\n• Led 12 people' }],
    education: [{ institution: 'TU Delft', degree: 'BSc', fieldOfStudy: 'Supply Chain' }],
  };
  const sections = resumeSections(draft);
  assert.deepEqual(sections.map((s) => s.key), ['summary', 'skills', 'experience', 'education']);
  assert.deepEqual(sections[2].items[0].lines, ['Cut errors 30%', 'Led 12 people']);
  // Formatted the way every other surface in the app formats a date range.
  assert.equal(sections[2].items[0].meta, '2022 \u2013 Present');
});

test('resumeSections omits sections with nothing in them', () => {
  assert.deepEqual(resumeSections(emptyDraft()), []);
  // A half-empty row is not a section worth rendering.
  assert.deepEqual(resumeSections({ ...emptyDraft(), experience: [{}] }), []);
});

test('isPresentable refuses to call a thin profile finished', () => {
  const thin = { ...emptyDraft(), title: 'PM', skills: ['Excel'] };
  assert.equal(isPresentable(thin), false, 'one skill and no evidence is not ready');
  assert.equal(isPresentable({ ...thin, skills: ['a', 'b', 'c'] }), false, 'still nothing evidencing them');
  assert.equal(
    isPresentable({ ...thin, skills: ['a', 'b', 'c'], experience: [{ title: 'Ops' }] }),
    true
  );
  // A project counts as evidence when there is no work history.
  assert.equal(
    isPresentable({ ...thin, skills: ['a', 'b', 'c'], projects: [{ title: 'Thing' }] }),
    true
  );
});

test('a probe question accepts typing even though its step does not', () => {
  const review = step('review');
  // The review step asks nothing itself, so on its own it takes no input...
  assert.equal(canAnswer(review, false), false);
  // ...but its follow-up questions are the one thing that must be typed.
  // The composer and the submit guard disagreeing here meant the send button
  // and Enter both silently did nothing.
  assert.equal(canAnswer(review, true), true);
});

test('canAnswer tracks the step for every ordinary question', () => {
  assert.equal(canAnswer(step('currentRole'), false), true);
  assert.equal(canAnswer(step('sector'), false), true);
  // Chip-only steps take no typing.
  assert.equal(canAnswer(step('workStyle'), false), false);
  // And nothing blows up before the first question arrives.
  assert.equal(canAnswer(undefined, false), false);
  assert.equal(canAnswer(null, true), true);
});

test('work style offers Flexible, for people who genuinely do not mind', () => {
  const chips = getChips(step('workStyle'), emptyDraft());
  const labels = chips.map((c) => c.label);
  assert.deepEqual(labels, ['Remote', 'Hybrid', 'On-site', 'Flexible']);
  // The id is what reaches the market query, which branches on it.
  assert.deepEqual(chips.map((c) => c.id), ['remote', 'hybrid', 'onsite', 'flexible']);
});

test('picking a work style records it on the draft', () => {
  const step_ = step('workStyle');
  assert.equal(step_.assign, 'workStyle');
  const out = applyToDraft(emptyDraft(), { [step_.assign]: 'flexible' });
  assert.equal(out.workStyle, 'flexible');
  // And the panel counts it as an answer to "looking for".
  assert.equal(panelState(out, []).lookingFor, true);
});

/* ─── Sector coverage ─────────────────────────────────────────
   The sector list is the first thing anyone sees, so it doubles as a
   statement about who the product is for. These guard the two ways that
   breaks: a sector with no titles/skills behind it, and an answer a real
   person would type falling through to the model. */

test('every sector has titles and skills behind it', () => {
  const missing = JOB_SECTORS.filter(
    (s) => !SECTOR_TITLES[s.id]?.length || !SECTOR_SKILLS[s.id]
  );
  assert.deepEqual(missing.map((s) => s.id), []);
});

test('the first sector screen is offered with a way to see the rest', () => {
  const first = sectorChips(false);
  const all = sectorChips(true);
  assert.ok(first.length < all.length, 'the short list must actually be shorter');
  assert.equal(first.at(-1).id, MORE_SECTORS_CHIP.id);
  assert.ok(!all.some((c) => c.id === MORE_SECTORS_CHIP.id), 'expanded list is answers only');
});

test('"More fields" is never resolved as an answer', () => {
  assert.equal(matchChip('More fields', sectorChips(false)), null);
});

test('sectors match how people describe their own work, not our labels', () => {
  const expected = {
    'I am an electrician': 'trades',
    'i work in a call center': 'support',
    'cna at a nursing home': 'healthcare',
    'I drive a truck': 'logistics',
    'barista at a coffee shop': 'hospitality',
    'warehouse associate': 'logistics',
    'lab technician': 'science',
    'substitute teacher': 'education',
    'I am a hairdresser': 'personal',
    'bookkeeper': 'finance',
    'security guard': 'publicservice',
  };
  for (const [said, sector] of Object.entries(expected)) {
    assert.equal(matchSector(said)?.sector, sector, `"${said}" should land in ${sector}`);
  }
});

/* ─── Levels ──────────────────────────────────────────────────
   The rungs have to be the ones the person's own trade uses, and they have
   to survive into a headline that reads like a job someone holds. */

test('every sector offers rungs, and the trades are not given an org chart', () => {
  for (const sector of JOB_SECTORS) {
    const levels = levelsFor(sector.id);
    assert.ok(levels.length >= 4, `${sector.id} needs a usable ladder`);
    const ids = levels.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length, `${sector.id} has a duplicate rung`);
  }
  const trades = levelsFor('trades').map((l) => l.label);
  assert.ok(trades.includes('Apprentice'), 'a tradesperson starts as an apprentice');
  assert.ok(
    !trades.some((l) => /individual contributor|head of department/i.test(l)),
    'the office ladder does not belong on a building site'
  );
});

test('the senior IC track is offered where it actually exists', () => {
  const tech = levelsFor('tech').map((l) => l.label);
  assert.ok(tech.includes('Staff') && tech.includes('Principal'));
  // Staff sits above Senior and before the management rungs.
  assert.ok(tech.indexOf('Staff') > tech.indexOf('Senior'));
  assert.ok(tech.indexOf('Principal') < tech.indexOf('Manager'));
  // ...and nowhere it does not: a Staff Barista is not a thing.
  const hospitality = levelsFor('hospitality').map((l) => l.label);
  assert.ok(!hospitality.some((l) => /staff|principal/i.test(l)));
});

test('a rung joins the title the way its own sector says it', () => {
  assert.equal(buildTitle({ sector: 'tech', level: 'staff', title: 'Software Engineer' }), 'Staff Software Engineer');
  assert.equal(buildTitle({ sector: 'data', level: 'principal', title: 'Data Scientist' }), 'Principal Data Scientist');
  assert.equal(buildTitle({ sector: 'trades', level: 'senior', title: 'Electrician' }), 'Master Electrician');
  assert.equal(buildTitle({ sector: 'trades', level: 'entry', title: 'Electrician' }), 'Apprentice Electrician');
  assert.equal(buildTitle({ sector: 'tech', level: 'senior', title: 'Frontend Developer' }), 'Senior Frontend Developer');
  // Standing, not a job: "Mid-level Software Engineer" is not a role.
  assert.equal(buildTitle({ sector: 'tech', level: 'ic', title: 'Software Engineer' }), 'Software Engineer');
  // Never say it twice.
  assert.equal(buildTitle({ sector: 'tech', level: 'senior', title: 'Senior Backend Engineer' }), 'Senior Backend Engineer');
});

/* ─── Title chips ─────────────────────────────────────────────
   The rank was the previous question. Repeating it here makes the person
   answer twice and buildTitle() say it three times. */

test('title chips carry the rank that was just given, exactly once', () => {
  const staff = titleChips('tech', 'staff').map((c) => c.label);
  assert.ok(staff.every((l) => /^staff /i.test(l)), `not all ranked: ${staff.join(', ')}`);
  assert.ok(!staff.some((l) => /staff.*staff/i.test(l)), 'said twice');
  // No bare/ranked pairs of the same role: that was the original bug.
  assert.equal(new Set(staff.map((l) => l.toLowerCase())).size, staff.length);

  // Each trade in its own words.
  assert.ok(titleChips('trades', 'senior').some((c) => c.label === 'Master Electrician'));
  assert.ok(titleChips('trades', 'entry').some((c) => c.label === 'Apprentice Electrician'));
});

test('rungs that are standing rather than rank leave the title alone', () => {
  // "Mid-level Frontend Developer" is not a job anyone holds.
  assert.deepEqual(
    titleChips('tech', 'ic').map((c) => c.label).slice(0, 2),
    ['Frontend Developer', 'Backend Developer']
  );
  // A leadership title already states its rank.
  assert.ok(!titleChips('tech', 'director').some((c) => /staff|senior /i.test(c.label)));
});

test('the rank they gave decides what is offered first', () => {
  const managing = titleChips('tech', 'director').map((c) => c.label);
  assert.ok(/manager|director|head of/i.test(managing[0]), `got ${managing[0]}`);
  const ic = titleChips('tech', 'senior').map((c) => c.label);
  assert.ok(!/manager|director|head of/i.test(ic[0]), `got ${ic[0]}`);
  // Both keep the full list underneath — a team lead can still be a developer.
  assert.ok(managing.length > 1);
});

test('there is always a way to answer something not on the list', () => {
  const step = (id) => LADDER.find((s) => s.id === id);
  for (const stepId of ['title', 'target']) {
    const chipStep = step(stepId);
    if (!chipStep) continue;
    const chips = getChips(chipStep, { sector: 'tech', level: 'senior', title: 'Software Engineer' });
    assert.equal(chips.at(-1).id, CUSTOM_ANSWER_CHIP.id, `${stepId} needs a keyboard door`);
  }
});

/* ─── Typed titles ────────────────────────────────────────────
   Whatever is typed here becomes the profile headline, read by recruiters
   exactly as it was typed into a chat box at speed. */

test('a typed title is tidied without being second-guessed', () => {
  assert.equal(normalizeTitle('staff data analysis'), 'Staff Data Analysis');
  assert.equal(normalizeTitle('PRODUCT MANAGER'), 'Product Manager');
  assert.equal(normalizeTitle('head of people'), 'Head of People');
  assert.equal(normalizeTitle('full-stack developer'), 'Full-Stack Developer');
  // The words are the person's own: "analysis" is not silently made "Analyst".
  assert.ok(normalizeTitle('data analysis').endsWith('Analysis'));
});

test('titles keep the capitals their field uses', () => {
  assert.equal(normalizeTitle('senior qa engineer'), 'Senior QA Engineer');
  assert.equal(normalizeTitle('ux designer'), 'UX Designer');
  assert.equal(normalizeTitle('devops engineer'), 'DevOps Engineer');
  assert.equal(normalizeTitle('ios developer'), 'iOS Developer');
  // Deliberate capitalisation survives untouched.
  assert.equal(normalizeTitle('eBay Seller'), 'eBay Seller');
});

/* ─── Targets ─────────────────────────────────────────────────
   "What are you aiming for next?" has to point somewhere the person is not
   already standing. */

test('targets lead with the next rung up, not with the rank they have', () => {
  const chips = targetChips({ sector: 'tech', level: 'staff', title: 'Staff Frontend Developer' })
    .map((c) => c.label);
  assert.equal(chips[0], 'Principal Frontend Developer');
  assert.ok(!chips.includes('Staff Frontend Developer'), 'never offer the job they hold');
  assert.ok(chips.some((c) => /manager/i.test(c)), 'the management branch is a real answer');
  // Sideways moves are legitimate, just not the headline.
  assert.ok(chips.indexOf('Staff Backend Developer') > 1);
});

test('a rank the trades use is a rank, not part of the job', () => {
  const chips = targetChips({ sector: 'trades', level: 'entry', title: 'Apprentice Electrician' })
    .map((c) => c.label);
  assert.ok(chips.includes('Master Electrician'));
  assert.ok(!chips.some((c) => /master apprentice/i.test(c)), 'stacked ranks');
});

test('sideways moves stay inside the same family of work', () => {
  const nurse = targetChips({ sector: 'healthcare', level: 'ic', title: 'Registered Nurse' })
    .map((c) => c.label);
  assert.ok(nurse.includes('Nurse Practitioner'));
  // A step down is not an ambition.
  assert.ok(!nurse.includes('Medical Assistant'));
});

/* ─── Links ───────────────────────────────────────────────────
   Whatever someone pastes, in whatever shape. */

test('links are filed by their domain, and none are dropped', () => {
  const links = parseLinks('linkedin.com/in/me, https://github.com/me and mysite.dev');
  assert.equal(links.linkedinUrl, 'https://linkedin.com/in/me');
  assert.equal(links.githubUrl, 'https://github.com/me');
  // Anything we cannot place is kept, not binned: they bothered to paste it.
  assert.equal(links.portfolioUrl, 'https://mysite.dev');
});

test('a link answer with no link in it is not silently accepted', () => {
  assert.deepEqual(parseLinks('i do not have one'), {});
  assert.deepEqual(parseLinks(''), {});
});

/* ─── The target conversation ─────────────────────────────────
   Two questions a careers adviser asks and a form never does. */

test('the coach asks why, and what is in the way, before it judges the gap', () => {
  const ids = LADDER.map((s) => s.id);
  assert.ok(ids.indexOf('targetWhy') > ids.indexOf('target'));
  assert.ok(ids.indexOf('targetBlocker') > ids.indexOf('targetWhy'));
  assert.ok(ids.indexOf('assess') > ids.indexOf('targetBlocker'), 'both must land before the assessment');
});

test('no target means no follow-ups about it', () => {
  const noTarget = { ...emptyDraft() };
  assert.equal(shouldSkip(step('targetWhy'), noTarget), true);
  assert.equal(shouldSkip(step('targetBlocker'), noTarget), true);
  const withTarget = { ...emptyDraft(), target: 'Principal Frontend Developer' };
  assert.equal(shouldSkip(step('targetWhy'), withTarget), false);
});

test('both follow-ups cost nothing and can be skipped', () => {
  for (const id of ['targetWhy', 'targetBlocker']) {
    const s = step(id);
    assert.equal(s.aiStep, null, `${id} must not spend a model call of its own`);
    assert.ok(s.optional, `${id} must be skippable`);
    assert.ok(getChips(s, {}).length > 0, `${id} needs chips`);
  }
});

/* ─── A work history, not a job ───────────────────────────────── */

test('an earlier job is only asked about when there is a later one', () => {
  assert.equal(shouldSkip(step('previousRole'), emptyDraft()), true);
  const employed = { ...emptyDraft(), experience: [{ company: 'Acme', title: 'Engineer' }] };
  assert.equal(shouldSkip(step('previousRole'), employed), false);
});

test('an earlier job lands under the current one, not on top of it', () => {
  const draft = {
    ...emptyDraft(),
    experience: [{ title: 'Staff Engineer', company: 'Acme', startDate: '2021', current: true }],
  };
  const merged = mergeInterpreted(
    draft,
    'currentRole',
    { title: 'Engineer', company: 'Globex', startDate: '2018', endDate: '2021' },
    { append: true }
  );
  assert.deepEqual(merged.experience.map((r) => r.company), ['Acme', 'Globex']);
  assert.equal(merged.experience[1].current, false);
});

test('a clarifier about the earlier job does not rewrite the current one', () => {
  const draft = {
    ...emptyDraft(),
    experience: [
      { title: 'Staff Engineer', company: 'Acme', startDate: '2021', current: true },
      { title: '', company: 'Globex', startDate: '', endDate: '' },
    ],
  };
  const merged = mergeInterpreted(
    draft,
    'currentRole',
    { title: 'Engineer', startDate: '2018', endDate: '2021' },
    { append: true, intoLatest: true }
  );
  assert.equal(merged.experience.length, 2, 'the clarifier fills the row, it does not add one');
  assert.equal(merged.experience[0].company, 'Acme');
  assert.equal(merged.experience[0].title, 'Staff Engineer');
  assert.equal(merged.experience[1].title, 'Engineer');
  assert.equal(merged.experience[1].startDate, '2018');
});
