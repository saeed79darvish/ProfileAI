import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { buildFixtures, OUT_DIR } from './build-fixtures.mjs';

let L;

before(async () => {
  await buildFixtures();
  L = await import(resolve(OUT_DIR, 'tailorLogic.mjs'));
});

const ORIGINAL = {
  title: 'Senior Software Engineer',
  summary: 'Engineer who builds web apps.',
  skills: ['React', 'Node'],
  experience: [
    { title: 'Engineer', company: 'Acme', description: 'Built things.' },
    { title: 'Developer', company: 'Beta', description: 'Fixed things.' },
  ],
};

const MATCH = {
  score: 71,
  components: { requiredYears: 3, candidateYears: 8 },
  surfaceable: ['GraphQL'],
  requirements: [
    { requirement: 'React', type: 'skill', hardness: 'must', coverage: 'strong' },
    { requirement: 'GraphQL', type: 'skill', hardness: 'nice', coverage: 'partial', evidence: '[2] used Apollo' },
    { requirement: 'Kubernetes', type: 'skill', hardness: 'must', coverage: 'none' },
    { requirement: 'Mentoring juniors', type: 'soft', hardness: 'nice', coverage: 'none' },
    { requirement: '5+ years experience', type: 'experience_years', hardness: 'must', coverage: 'none' },
    { requirement: 'Own the roadmap', type: 'responsibility', coverage: 'none' },
  ],
};

// ── the change list ─────────────────────────────────────────────────────────

test('buildChanges lists only real before/after differences', () => {
  const tailored = {
    title: 'Senior Software Engineer', // unchanged
    summary: 'Engineer who builds React web apps.',
    skills: ['React', 'Node'], // unchanged
    experience: [
      { title: 'Engineer', company: 'Acme', description: 'Built things.' }, // unchanged
      { title: 'Developer', company: 'Beta', description: 'Fixed things faster.' },
    ],
    changelog: [
      { section: 'experience_1', action: 'kept', detail: 'Copied from the record unchanged' },
    ],
  };
  const changes = L.buildChanges(ORIGINAL, tailored, ['react']);
  assert.deepEqual(changes.map((c) => c.id), ['summary', 'exp-1']);
  assert.equal(changes[0].before, ORIGINAL.summary);
  assert.equal(changes[0].reason, "Uses 1 of the job's keywords.");
});

test('model bookkeeping never becomes a reason', () => {
  const noise = [
    'REPETITION: react: Reworded to avoid repeating the verb',
    'originals restored for every role',
    'Copied from the record unchanged',
    'Omitted per preference',
  ];
  for (const detail of noise) {
    const reason = L.changelogReason([{ section: 'summary', action: 'rewrote', detail }], ['summary']);
    assert.equal(reason, '', `leaked: ${detail}`);
  }
  assert.equal(
    L.changelogReason([{ section: 'summary', action: 'rewrote', detail: 'Leads with payments experience' }], ['summary']),
    'Leads with payments experience.',
  );
  assert.equal(
    L.changelogReason([{ section: 'summary', action: 'corrected', detail: 'Leads with payments experience' }], ['summary']),
    '',
  );
});

test('a no-op title or skills entry produces no change', () => {
  const same = { ...ORIGINAL, changelog: [{ section: 'title', action: 'rewrote', detail: 'Matched the posting title' }] };
  assert.equal(L.buildChanges(ORIGINAL, same, []).length, 0);
});

// ── keywords ────────────────────────────────────────────────────────────────

test('countKeywords respects symbols and word edges', () => {
  const text = 'built c++ services with node.js and java';
  assert.equal(L.countKeywords(['c++', 'node.js', 'java', 'javascript', 'go'], text), 3);
  assert.equal(L.countKeywords(['go'], 'good going'), 0);
});

test('resumeText reads title, summary, skills, roles and projects', () => {
  const t = L.resumeText({ title: 'Eng', summary: 'S', skills: ['Go'], experience: [{ title: 'T', description: 'D' }], projects: [{ name: 'P', description: 'Q' }] });
  for (const bit of ['eng', 'go', 'd', 'p q']) assert.ok(t.includes(bit), bit);
});

// ── fit and consistency ─────────────────────────────────────────────────────

test('questions skip covered and unaskable kinds, required first', () => {
  const qs = L.questionsFor(MATCH).map(L.label);
  assert.deepEqual(qs, ['Kubernetes', 'GraphQL', 'Mentoring juniors']);
});

test('coverage counts use one total before and after', () => {
  const c = L.coverageCounts(MATCH, ['Kubernetes'], MATCH.surfaceable);
  assert.equal(c.total, 5); // responsibility excluded
  assert.equal(c.before, 1);
  assert.equal(c.after, 3);
  assert.equal(c.gapsBefore + c.before, c.total);
  assert.equal(c.gapsAfter + c.after, c.total);
});

test('the score after tailoring never shows lower than what the candidate saw', () => {
  assert.equal(L.displayAfterScore(58, 71, 71), 71);
  assert.equal(L.displayAfterScore(88, 74, 71), 88);
  assert.equal(L.displayAfterScore(null, 74, 71), null);
});

test('rescore labels merge confirmed and surfaceable without duplicates', () => {
  assert.deepEqual(L.rescoreLabels(['A', 'B'], ['B', 'C']), ['A', 'B', 'C']);
  assert.deepEqual(L.rescoreLabels([], undefined), []);
});

test('seniority note only when well over the ask', () => {
  assert.match(L.seniorityNote(MATCH, 'Senior Software Engineer'), /Senior wording/);
  assert.equal(L.seniorityNote({ ...MATCH, components: { requiredYears: 5, candidateYears: 6 } }, 'Senior'), '');
});

// ── plan and request ────────────────────────────────────────────────────────

test('plan: title pair stays exclusive and one is always on', () => {
  const plan = L.buildPlan({ profile: ORIGINAL, job: { title: 'Staff Engineer', company: 'Acme' }, match: MATCH, confirmed: [], pages: 1 });
  const title = plan.find((s) => s.key === 'title');
  assert.equal(title.options.find((o) => o.id === 'match').on, true);
  assert.ok(title.options.find((o) => o.id === 'tone'));
  // turning the already-on one off is refused
  const same = L.toggleOption(plan, 'title', 'match');
  assert.equal(same.find((s) => s.key === 'title').options.find((o) => o.id === 'match').on, true);
  // turning the other on flips the pair
  const flipped = L.toggleOption(plan, 'title', 'keep');
  const opts = flipped.find((s) => s.key === 'title').options;
  assert.equal(opts.find((o) => o.id === 'keep').on, true);
  assert.equal(opts.find((o) => o.id === 'match').on, false);
});

test('gap selections carry only confirmed items, with evidence', () => {
  assert.equal(L.buildGapSelections([], {}), undefined);
  const k = MATCH.requirements[2];
  const g = L.buildGapSelections([k], { Kubernetes: ' ran clusters at Acme ' });
  assert.deepEqual(g.acceptedGaps, ['Kubernetes']);
  assert.equal(g.acceptedGapObjects[0].severity, 'critical');
  assert.equal(g.acceptedGapObjects[0].customPrompt, 'ran clusters at Acme');
  assert.equal(g.confirmedEvidence[0].evidence, 'ran clusters at Acme');
});

test('still-missing excludes covered and confirmed requirements', () => {
  const left = L.stillMissing(MATCH, { Kubernetes: 'yes' }).map((x) => x.skill);
  assert.ok(!left.includes('React'));
  assert.ok(!left.includes('Kubernetes'));
  assert.ok(left.includes('GraphQL'));
});

test('tailor settings reflect the plan and page count', () => {
  const plan = L.buildPlan({ profile: ORIGINAL, job: { title: 'Senior Software Engineer' }, match: MATCH, confirmed: [], pages: 2 });
  const s = L.buildTailorSettings(plan, 2, { summary: 'x' });
  assert.equal(s.pages, 2);
  assert.equal(s.experienceLines, 5);
  assert.equal(s.plan.keepTitle, true);
  assert.deepEqual(s.sectionNotes, { summary: 'x' });
});

// ── keep, skip, refine ──────────────────────────────────────────────────────

test('buildCopy puts skipped sections back and applies refinements', () => {
  const tailored = {
    title: 'Staff Engineer',
    summary: 'New summary',
    skills: ['Go', 'React'],
    skillsGrouped: { Languages: ['Go'] },
    experience: [
      { title: 'Engineer', company: 'Acme', description: 'Built things.' },
      { title: 'Developer', company: 'Beta', description: 'Fixed things faster.' },
    ],
  };
  const changes = L.buildChanges(ORIGINAL, tailored, []);
  assert.deepEqual(changes.map((c) => c.id), ['title', 'summary', 'skills', 'exp-1']);
  const kept = { title: false, summary: true, skills: false, 'exp-1': true };
  const copy = L.buildCopy(tailored, ORIGINAL, changes, kept, { 'exp-1': 'Fixed things, 40% faster.' });
  assert.equal(copy.title, ORIGINAL.title);
  assert.equal(copy.summary, 'New summary');
  assert.deepEqual(copy.skills, ORIGINAL.skills);
  assert.equal(copy.skillsGrouped, undefined);
  assert.equal(copy.experience[1].description, 'Fixed things, 40% faster.');
  // inputs untouched
  assert.equal(tailored.experience[1].description, 'Fixed things faster.');
  assert.equal(L.keptCount(changes, kept), 2);
});

test('refine request targets one role and pickRefined reads it back', () => {
  const tailored = { ...ORIGINAL, experience: [ORIGINAL.experience[0], { ...ORIGINAL.experience[1], description: 'Rewritten.' }] };
  const changes = L.buildChanges(ORIGINAL, tailored, []);
  const req = L.buildRefineRequest(tailored, changes[0], 'Shorter', 'Staff Engineer', 'Acme');
  assert.match(req.instructions.experience, /entry 2 \("Developer" at Beta\)/);
  assert.equal(L.pickRefined({ experience: [{}, { description: ' Short. ' }] }, changes[0]), 'Short.');
  assert.equal(L.pickRefined({}, changes[0]), '');
});

// ── usage limit ─────────────────────────────────────────────────────────────

test('parseLimit only recognises a 429 with a body', () => {
  assert.equal(L.parseLimit(500, { error: 'x' }), null);
  assert.equal(L.parseLimit(429, null), null);
  const lim = L.parseLimit(429, { error: 'Lifetime trial used', message: 'Upgrade to continue.', resetAt: '2026-09-01T00:00:00.000Z', upgradeRequired: true });
  assert.equal(lim.upgradeRequired, true);
  assert.equal(lim.buyMoreUrl, '/pricing');
  const copy = L.limitCopy(lim);
  assert.match(copy.body, /Upgrade to continue\./);
  assert.match(copy.body, /Sep/);
});

test('progress index follows elapsed time', () => {
  assert.equal(L.progressIndex(0), 0);
  assert.equal(L.progressIndex(3500), 1);
  assert.equal(L.progressIndex(31000), 3);
});

test('platformOf reads the host', () => {
  assert.equal(L.platformOf('https://www.lever.co/acme/123'), 'lever.co');
  assert.equal(L.platformOf('nonsense'), undefined);
});
