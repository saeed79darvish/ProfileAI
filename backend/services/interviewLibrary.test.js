const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('./interviewLibrary');
const { makeInterviewPrepService, companyKeyOf, roleKeyOf } = require('./interviewPrepService');

const keysOf = (e) => ({ companyKey: companyKeyOf(e.company), roleKey: roleKeyOf(e.jobTitle) });

test('libraryMatch: well-known companies and general software titles map onto an entry, everything else does not', () => {
  const m = (c, t) => lib.libraryMatch(c, t);
  assert.deepEqual(m('Google LLC', 'Senior Frontend Software Engineer'), { company: 'Google', jobTitle: 'Frontend Engineer', companyId: 'google', roleId: 'frontend' });
  assert.equal(m('Meta Platforms, Inc.', 'Software Engineer, Infrastructure').company, 'Meta');
  assert.equal(m('facebook', 'Full Stack Developer').jobTitle, 'Software Engineer');
  assert.equal(m('Stripe', 'Staff Backend Engineer').jobTitle, 'Backend Engineer');
  assert.equal(m('Airbnb', 'Engineering Manager'), null);
  assert.equal(m('Nvidia', 'Machine Learning Engineer'), null);
  assert.equal(m('Google Fiber Dental', 'Software Engineer'), null);
  assert.equal(m('David AI', 'Frontend Software Engineer'), null);
  assert.equal(m('', 'Software Engineer'), null);
  assert.equal(lib.libraryEntries().length, lib.COMPANIES.length * lib.ROLES.length);
});

function memoryPreps(rows = []) {
  const all = rows.map((r, i) => ({ id: `id${i}`, update: async function (p) { Object.assign(this, p); return this; }, ...r }));
  return {
    all,
    findAll: async () => all,
    findOne: async ({ where }) => all.find((r) => r.companyKey === where.companyKey && r.roleKey === where.roleKey) || null,
    findByPk: async (id) => all.find((r) => r.id === id) || null,
    create: async (v) => { const row = { id: `id${all.length}`, update: async function (p) { Object.assign(this, p); return this; }, ...v }; all.push(row); return row; },
  };
}

test('start: a library company with a general title uses the library entry, kept for 45 days', async () => {
  process.env.INTERVIEW_LIBRARY_AUTO = 'true';
  try {
  const InterviewPrep = memoryPreps();
  const seen = [];
  const svc = makeInterviewPrepService({ InterviewPrep, getResearch: () => async (input) => { seen.push(input); return { coverage: 'good', questions: [], sources: [], company: input.company, role: input.jobTitle }; }, now: () => new Date('2026-11-08T00:00:00Z') });
  const out = await svc.start({ company: 'Google LLC', jobTitle: 'Senior Frontend Software Engineer' });
  await svc.whenIdle();
  assert.equal(out.status, 'pending');
  assert.deepEqual(seen.map((s) => [s.company, s.jobTitle]), [['Google', 'Frontend Engineer']]);
  const row = InterviewPrep.all[0];
  assert.equal(row.companyKey, 'google');
  assert.equal(row.roleKey, 'engineer frontend');
  assert.equal(Math.round((new Date(row.expiresAt) - new Date(row.generatedAt)) / 86400000), 45);
  // a second person with a different spelling gets the same entry without new research
  const again = await svc.start({ company: 'Google', jobTitle: 'Frontend Developer' });
  assert.equal(again.status, 'ready');
  assert.equal(seen.length, 1);
  // a company outside the library keeps today's 21 days and its own title
  await svc.start({ company: 'David AI', jobTitle: 'Frontend Software Engineer' });
  await svc.whenIdle();
  assert.equal(seen[1].jobTitle, 'Frontend Software Engineer');
  const other = InterviewPrep.all.find((r) => r.companyKey === 'david ai');
  assert.equal(Math.round((new Date(other.expiresAt) - new Date(other.generatedAt)) / 86400000), 21);
  } finally { delete process.env.INTERVIEW_LIBRARY_AUTO; }
});

test('start: with the library off, titles are used as typed', async () => {
  delete process.env.INTERVIEW_LIBRARY_AUTO;
  const InterviewPrep = memoryPreps();
  const seen = [];
  const svc = makeInterviewPrepService({ InterviewPrep, getResearch: () => async (input) => { seen.push(input); return { coverage: 'good', questions: [], sources: [] }; } });
  await svc.start({ company: 'Google LLC', jobTitle: 'Senior Frontend Software Engineer' });
  await svc.whenIdle();
  assert.deepEqual(seen.map((s) => [s.company, s.jobTitle]), [['Google LLC', 'Senior Frontend Software Engineer']]);
  assert.equal(InterviewPrep.all[0].companyKey, 'google');
  assert.equal(InterviewPrep.all[0].roleKey, 'engineer frontend senior software');
});

test('pickStale: missing first, then failed, then thin, then old; fresh and pending are left alone', async () => {
  const now = new Date('2026-11-08T00:00:00Z');
  const daysAgo = (d) => new Date(now - d * 86400000);
  const row = (e, extra) => ({ ...keysOf(e), ...extra });
  const entries = lib.libraryEntries();
  const [a, b, c, d, f, g] = entries;
  const InterviewPrep = memoryPreps([
    row(a, { status: 'ready', generatedAt: daysAgo(40), payload: { coverage: 'good' } }),
    row(b, { status: 'failed', generatedAt: null }),
    row(c, { status: 'ready', generatedAt: daysAgo(3), payload: { coverage: 'none' } }),
    row(d, { status: 'ready', generatedAt: daysAgo(5), payload: { coverage: 'good' } }),
    row(f, { status: 'pending', generatedAt: null }),
    row(g, { status: 'ready', generatedAt: daysAgo(35), payload: { coverage: 'good' } }),
  ]);
  const picked = await lib.pickStale({ models: { InterviewPrep }, keysOf, now, max: 8 });
  const names = picked.map((e) => `${e.company}/${e.roleId}`);
  assert.equal(picked.length, 8);
  assert.ok(!names.includes(`${d.company}/${d.roleId}`), 'fresh entry skipped');
  assert.ok(!names.includes(`${f.company}/${f.roleId}`), 'pending entry skipped');
  assert.ok(picked.slice(0, 3).every((e) => !InterviewPrep.all.some((r) => r.companyKey === keysOf(e).companyKey && r.roleKey === keysOf(e).roleKey)), 'never built come first');
  const only = await lib.pickStale({ models: { InterviewPrep }, keysOf, now, only: ['stripe'], roles: ['backend'], max: 5 });
  assert.deepEqual(only.map((e) => `${e.company}/${e.roleId}`), ['Stripe/backend']);
});

test('refreshLibrary: runs entries one at a time, reports each, dry run starts nothing, a failure does not stop the rest', async () => {
  const InterviewPrep = memoryPreps();
  let calls = 0;
  const svc = makeInterviewPrepService({
    InterviewPrep,
    getResearch: () => async (input) => {
      calls += 1;
      if (input.company === 'Apple') throw new Error('search down');
      return { coverage: 'good', questions: [{ text: 'q' }], sources: [{ url: 'u' }], company: input.company, role: input.jobTitle };
    },
  });
  const lines = [];
  const dry = await lib.refreshLibrary({ service: svc, models: { InterviewPrep }, keysOf, max: 3, dryRun: true, pauseMs: 0, log: (l) => lines.push(l) });
  assert.equal(dry.length, 3);
  assert.equal(calls, 0);
  const out = await lib.refreshLibrary({ service: svc, models: { InterviewPrep }, keysOf, only: ['google', 'apple'], roles: ['software'], max: 5, pauseMs: 0, log: (l) => lines.push(l) });
  assert.deepEqual(out.map((r) => [r.company, r.status]), [['Google', 'ready'], ['Apple', 'failed']]);
  assert.equal(out[0].questions, 1);
  assert.ok(lines.some((l) => /Google \/ Software Engineer: ready/.test(l)));
});

test('the scheduler is off unless INTERVIEW_LIBRARY_AUTO is true', () => {
  assert.equal(lib.startLibraryScheduler({ env: {}, log: () => {} }), null);
  assert.equal(lib.startLibraryScheduler({ env: { INTERVIEW_LIBRARY_AUTO: 'false' }, log: () => {} }), null);
  const s = lib.startLibraryScheduler({ env: { INTERVIEW_LIBRARY_AUTO: 'true', INTERVIEW_LIBRARY_PER_RUN: '2' }, log: () => {} });
  assert.ok(s && typeof s.stop === 'function');
  s.stop();
});
