const { test } = require('node:test');
const assert = require('node:assert/strict');

const { applyAcceptedGaps, withoutAcceptedGaps, FAMILIAR_GROUP } = require('./acceptedGaps');

/** The gaps the candidate accepted on the Solace posting. */
const ACCEPTED = ['NestJS', 'Postgres', 'TypeORM', 'Redis', 'Tailwind', 'GCP'];

const draft = () => ({
  summary: 'Builds React and TypeScript platforms with Node.js services behind them.',
  skillsGrouped: {
    Languages: ['TypeScript', 'JavaScript'],
    Frameworks: ['React', 'Next.js'],
    Infrastructure: ['AWS', 'Docker'],
  },
  skills: ['TypeScript', 'JavaScript', 'React', 'Next.js', 'AWS', 'Docker'],
  experience: [{ description: '• Built GraphQL APIs in Node.js' }],
});

test('the reported defect: accepted gaps actually reach the resume', () => {
  const d = draft();
  const r = applyAcceptedGaps(d, ACCEPTED);
  assert.equal(r.added.length, 6, 'accepting a gap still does nothing');
  for (const gap of ACCEPTED) {
    assert.ok(d.skills.includes(gap), `${gap} was accepted and never applied`);
  }
});

test('unevidenced skills are labelled rather than claimed outright', () => {
  const d = draft();
  applyAcceptedGaps(d, ACCEPTED);
  // A recruiter can see the difference; a keyword scan finds the term either way.
  assert.deepEqual(d.skillsGrouped[FAMILIAR_GROUP].sort(), [...ACCEPTED].sort());
  assert.ok(!d.skillsGrouped.Languages.includes('NestJS'), 'claimed as a core skill');
});

test('a gap the original DOES support is placed as a real skill', () => {
  const d = draft();
  // 'Express' is in the candidate's ORIGINAL resume but not in this draft, so
  // it is a gap only in the sense that tailoring failed to surface it.
  const r = applyAcceptedGaps(d, ['Express'], { isEvidenced: (t) => t === 'Express' });
  assert.deepEqual(r.added, ['Express']);
  assert.ok(!(d.skillsGrouped[FAMILIAR_GROUP] || []).includes('Express'), 'hedged a skill the candidate can defend');
  assert.ok(d.skills.includes('Express'));
});

test('a gap already on the resume is not added twice', () => {
  const d = draft();
  const r = applyAcceptedGaps(d, ['React', 'AWS']);
  assert.deepEqual(r.added, []);
  assert.deepEqual(r.alreadyPresent.sort(), ['AWS', 'React']);
  assert.equal(d.skills.filter((s) => s === 'React').length, 1);
});

test('a gap the model already wove into a bullet is not re-added', () => {
  const d = draft();
  const r = applyAcceptedGaps(d, ['GraphQL']);
  assert.deepEqual(r.added, [], 'duplicated a term already in the experience text');
});

test('the flat and grouped skill views stay in agreement', () => {
  const d = draft();
  applyAcceptedGaps(d, ACCEPTED);
  assert.deepEqual(d.skills.slice().sort(), Object.values(d.skillsGrouped).flat().sort());
});

test('a draft with only a flat skills array still works', () => {
  const d = { skills: ['React'], summary: '', experience: [] };
  applyAcceptedGaps(d, ['Redis']);
  assert.ok(d.skills.includes('Redis'));
  assert.ok(d.skills.includes('React'), 'existing skills were lost');
});

test('nothing accepted changes nothing', () => {
  const d = draft();
  const before = JSON.stringify(d);
  const r = applyAcceptedGaps(d, []);
  assert.deepEqual(r.added, []);
  assert.equal(JSON.stringify(d), before);
});

test('junk input does not throw', () => {
  assert.doesNotThrow(() => applyAcceptedGaps({}, null));
  assert.doesNotThrow(() => applyAcceptedGaps({ skills: null }, [null, '', 42, 'Redis']));
});

// ── Not re-listing a decision as an outstanding gap ─────────────────────────

test('accepted gaps disappear from the still-missing list', () => {
  const gaps = [
    { requirement: 'NestJS (hard blocker, listed as the API framework): no NestJS anywhere', status: 'not evidenced' },
    { requirement: 'Redis (nice-to-have): no caching work', status: 'not evidenced' },
    { requirement: '10+ years of experience', status: 'partially met' },
  ];
  const left = withoutAcceptedGaps(gaps, ['NestJS', 'Redis']);
  assert.equal(left.length, 1);
  assert.match(left[0].requirement, /10\+ years/);
});

test('an exact-match gap line is removed too', () => {
  const left = withoutAcceptedGaps([{ requirement: 'GCP' }], ['gcp']);
  assert.deepEqual(left, []);
});

test('a gap that merely mentions an accepted term in passing is kept', () => {
  // Only a line that LEADS with the accepted term is that gap.
  const gaps = [{ requirement: 'Database architecture (hard blocker): no Postgres or schema design' }];
  const left = withoutAcceptedGaps(gaps, ['Postgres']);
  assert.equal(left.length, 1, 'removed an unrelated requirement that merely named the term');
});

test('nothing accepted leaves the gap list untouched', () => {
  const gaps = [{ requirement: 'NestJS' }];
  assert.deepEqual(withoutAcceptedGaps(gaps, []), gaps);
  assert.deepEqual(withoutAcceptedGaps(gaps, null), gaps);
});

// ── The list the extension renders, with the wording the models actually use ─
test('the reported defect: accepted gaps vanish from matchAnalysis.gaps (plain strings)', () => {
  const stillMissing = [
    'NestJS and TypeORM (required stack): the resume shows no NestJS',
    'Postgres and relational database architecture (required): only MongoDB',
    'Redis (stack item, not an explicit requirement): no usage in the resume',
    'Tailwind and shadcn (stack item): design system and components are custom',
    'GCP (stack item): the resume shows AWS only.',
    'Startup experience building products from scratch (required): Threedy.ai only',
    '10+ years of experience: the dated roles span about six',
  ];
  const accepted = ['NestJS', 'TypeORM', 'Postgres', 'Redis', 'Tailwind CSS and shadcn/ui', 'GCP', 'Startup 0-to-1 experience'];
  const left = withoutAcceptedGaps(stillMissing, accepted);
  assert.deepEqual(left, ['10+ years of experience: the dated roles span about six']);
});

test('the accepted name and the gap line need not share wording exactly', () => {
  assert.deepEqual(withoutAcceptedGaps(['NestJS and TypeORM (required stack): none'], ['NestJS/TypeORM']), []);
  assert.deepEqual(withoutAcceptedGaps(['Postgres and relational database architecture'], ['PostgreSQL']), ['Postgres and relational database architecture'],
    'a different spelling is not guessed at — better to leave a line than to hide a real gap');
});

test('a line that only mentions the accepted term in its explanation is kept', () => {
  // The head is "Database architecture"; Postgres appears only in the reason.
  const line = 'Database architecture (required): no Postgres or schema design in the resume';
  assert.deepEqual(withoutAcceptedGaps([line], ['Postgres']), [line]);
});
