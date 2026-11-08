const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { buildRouter } = require('../routes/interviewPrep');
const svc = require('./interviewPrepService');
const { makeInterviewPrepService } = svc;
const { parseJob } = require('./interviewJobParseService');
const { createCoachTailorService, CoachTailorError } = require('./coachTailorService');
const { suggestTopics, storyQuestions, writeStory } = require('./interviewStoriesService');

const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = new Date('2026-11-01T00:00:00Z');
const POSTING = 'We are Globex and we are hiring a Senior Backend Engineer to build billing systems. '.repeat(5);

/* ---------- generic in-memory model ---------- */
function fakeModel(prefix, uniq) {
  const rows = [];
  const match = (r, where = {}) => Object.entries(where).every(([k, v]) => (Array.isArray(v) ? v.includes(r[k]) : r[k] === v));
  const wrap = (data) => {
    const row = { id: UUID(prefix + rows.length), createdAt: new Date(), updatedAt: new Date(), ...data };
    row.update = async (patch) => Object.assign(row, patch);
    rows.push(row);
    return row;
  };
  return {
    rows,
    findOne: async ({ where }) => rows.find((r) => match(r, where)) || null,
    findByPk: async (id) => rows.find((r) => r.id === id) || null,
    findAll: async ({ where, order, limit } = {}) => {
      let out = rows.filter((r) => match(r, where));
      if (order && order[0]) { const [k, dir] = order[0]; out = out.sort((a, b) => (dir === 'DESC' ? 1 : -1) * (new Date(a[k]) - new Date(b[k])) * -1); }
      return limit ? out.slice(0, limit) : out;
    },
    create: async (d) => {
      if (uniq && rows.find((r) => uniq.every((k) => r[k] === d[k]))) throw Object.assign(new Error('dup'), { name: 'SequelizeUniqueConstraintError' });
      return wrap(d);
    },
    update: async (patch, { where }) => { rows.filter((r) => match(r, where)).forEach((r) => Object.assign(r, patch)); },
  };
}

const PAYLOAD = (o = {}) => ({ company: 'Acme', role: 'Engineer', coverage: 'good', topics: [], questions: [{ text: 'Design a cache', category: 'system_design' }], ...o });

async function setup({ tier = 'pro', resolveJob, parseModel } = {}) {
  const InterviewPrep = fakeModel(1, ['companyKey', 'roleKey']);
  const UserInterviewPrep = fakeModel(500, ['userId', 'prepId']);
  const InterviewStory = fakeModel(900);
  const researchCalls = [];
  const service = makeInterviewPrepService({
    InterviewPrep,
    getResearch: () => async (input) => { researchCalls.push(input); return PAYLOAD({ company: input.company, role: input.jobTitle, scope: input.company ? 'company' : 'role' }); },
  });
  const models = {
    InterviewPrep, UserInterviewPrep, InterviewStory,
    TailoredProfile: { findOne: async ({ where }) => (where.id === UUID(7) && where.userId === 'u1' ? { id: UUID(7), jobTitle: 'X', tailoredData: { summary: 's' } } : null) },
    Profile: { findOne: async () => ({ toJSON: () => ({ title: 'Engineer', experience: [{ company: 'Equinix' }] }) }) },
  };
  const modelCalls = [];
  const runModel = parseModel || (async (a) => { modelCalls.push(a); if (a.purpose === 'personalize') return JSON.stringify({ probes: [1, 2, 3, 4].map((i) => ({ question: `Q${i}`, why: 'w', basedOn: 'Equinix' })) }); return JSON.stringify({ company: 'Globex', jobTitle: 'Senior Backend Engineer', level: 'senior', summary: 'Builds billing systems.' }); });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: req.headers['x-user'] || 'u1', role: 'candidate', subscriptionTier: req.headers['x-tier'] || tier }; next(); });
  const pass = (req, res, next) => next();
  app.use('/api/interview-prep', buildRouter({
    service, authMiddleware: pass, limiter: pass, recordUsage: async () => {}, runModel, models, storyLimiter: pass, storyModel: runModel,
    resolveJob: resolveJob || (async () => ({ jobDescription: POSTING, jobTitle: '', company: '', source: 'link' })),
  }));
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/interview-prep`;
  const call = async (path, body, user, method = body ? 'POST' : 'GET') => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  return { call, service, models, researchCalls, modelCalls, close: () => server.close() };
}

/* ---------- parse-job ---------- */

test('parse-job: link goes through the injected resolver and returns the contract shape', async () => {
  const seen = [];
  const t = await setup({ resolveJob: async (a) => { seen.push(a); return { jobDescription: POSTING, jobTitle: 'Senior Backend Engineer', company: 'Globex', source: 'link' }; } });
  const r = await t.call('/parse-job', { url: 'https://jobs.example.com/1' });
  t.close();
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { success: true, job: { company: 'Globex', jobTitle: 'Senior Backend Engineer', level: 'senior', summary: 'Builds billing systems.', source: 'link' } });
  assert.equal(seen[0].jobUrl, 'https://jobs.example.com/1');
  assert.equal(t.modelCalls[0].purpose, 'parse_job');
  assert.equal(t.modelCalls[0].temperature, undefined);
});

test('parse-job: pasted text is source text, and an unknown level is normalized', async () => {
  const t = await setup({
    resolveJob: async ({ jobDescription }) => ({ jobDescription, jobTitle: '', company: '', source: 'text' }),
    parseModel: async () => '```json\n{"company":"","jobTitle":"Chef","level":"Wizard","summary":"Cooks."}\n```',
  });
  const r = await t.call('/parse-job', { text: POSTING });
  t.close();
  assert.equal(r.status, 200);
  assert.equal(r.body.job.source, 'text');
  assert.equal(r.body.job.company, '');
  assert.equal(r.body.job.level, 'unknown');
});

test('parse-job: unreadable link is 422 unreadable with the exact message', async () => {
  const t = await setup({ resolveJob: async () => { throw new CoachTailorError(422, 'job_url_unreadable', 'x'); } });
  const r = await t.call('/parse-job', { url: 'https://jobs.example.com/1' });
  t.close();
  assert.equal(r.status, 422);
  assert.deepEqual(r.body, { success: false, code: 'unreadable', message: 'We could not read that page. Paste the job description instead.' });
});

test('parse-job: free tier is 403, empty input is 400, no allowance recorded', async () => {
  const t2 = await setup({ tier: 'free' });
  const r1 = await t2.call('/parse-job', { text: POSTING });
  t2.close();
  assert.equal(r1.status, 403);
  assert.equal(r1.body.code, 'upgrade_required');
  const t3 = await setup();
  const r2 = await t3.call('/parse-job', {});
  t3.close();
  assert.equal(r2.status, 400);
  assert.equal(r2.body.success, false);
});

test('parse-job: a model that returns nothing usable is a 502, not a crash', async () => {
  await assert.rejects(parseJob({ text: POSTING }, { resolveJob: async () => ({ jobDescription: POSTING, source: 'text' }), runModel: async () => 'nope' }), (e) => e.status === 502);
});

test('coach resolveJob is exported, uses the guarded fetcher dependency and tags the source', async () => {
  const s = createCoachTailorService({ fetchJobPosting: async () => ({ jobDescription: POSTING, jobTitle: 'Dev', company: 'Globex' }) });
  assert.equal(typeof s.resolveJob, 'function');
  const viaLink = await s.resolveJob({ jobUrl: 'https://jobs.example.com/1' });
  assert.equal(viaLink.source, 'link');
  assert.equal(viaLink.company, 'Globex');
  const viaText = await s.resolveJob({ jobDescription: POSTING });
  assert.equal(viaText.source, 'text');
  await assert.rejects(s.resolveJob({ jobUrl: 'http://127.0.0.1/x' }), (e) => e.status === 400);
});

/* ---------- role scope ---------- */

test('role scope: queries have no empty company token and carry the level', () => {
  const qs = svc.buildQueries('', 'Frontend Developer', 'senior').map((q) => q.query);
  assert.ok(qs.length >= 6);
  for (const q of qs) {
    assert.ok(!/^\s|\s{2,}|undefined/.test(q), `bad query: "${q}"`);
    assert.match(q, /senior/i);
    assert.match(q, /frontend developer/i);
  }
  assert.ok(qs.includes('senior Frontend Developer interview questions'));
  // company preps unchanged
  assert.equal(svc.buildQueries('Acme', 'Engineer')[0].query, 'Acme Engineer interview questions');
});

test('role scope: research with no company still gathers forum posts and tells the extractor it is general', async () => {
  const post = (n, site) => ({ title: `Senior frontend interview ${n}`, url: `https://${site}/comments/${n}/x`, site, content: 'I interviewed for a senior frontend role. They asked about closures and rendering performance in detail. '.repeat(6), publishedAt: '2026-09-01' });
  const queries = [];
  const search = async ({ query }) => { queries.push(query); return [post(Math.random().toString(36).slice(2), 'reddit.com')]; };
  const prompts = [];
  const runModel = async ({ purpose, prompt, system }) => {
    prompts.push({ purpose, prompt, system });
    if (purpose === 'extract') return JSON.stringify({ questions: [{ text: 'Explain closures', category: 'coding', sources: [0] }], rounds: [], tips: [], topics: [], timeline: null });
    return '{"summary":"s"}';
  };
  const p = await svc.researchInterview({ company: '', jobTitle: 'Frontend Developer', level: 'senior', search, runModel, now: NOW });
  assert.equal(p.company, '');
  assert.equal(p.scope, 'role');
  assert.ok(p.questions.length >= 1);
  assert.ok(queries.every((q) => !/undefined/.test(q) && !/^\s/.test(q)));
  const ex = prompts.find((x) => x.purpose === 'extract');
  assert.match(ex.system, /general/);
  assert.match(ex.prompt, /across companies/);
  assert.match(ex.prompt, /Level: senior/);
  const summary = prompts.find((x) => x.purpose === 'summary');
  assert.ok(!/Company: \n/.test(summary.prompt));
  // company preps are marked as such
  const c = await svc.researchInterview({ company: 'Acme', jobTitle: 'Engineer', search, runModel, now: NOW });
  assert.equal(c.scope, 'company');
});

test('role scope: start() uses the general key, separates levels, and still demands a company or a level', async () => {
  const t = await setup();
  const a = await t.service.start({ company: '', jobTitle: 'Frontend Developer', level: 'senior' });
  const b = await t.service.start({ company: '', jobTitle: 'Frontend Developer', level: 'junior' });
  const a2 = await t.service.start({ company: '', jobTitle: 'frontend developer', level: 'Senior' });
  t.close();
  await t.service.whenIdle();
  assert.notEqual(a.id, b.id);
  assert.equal(a.id, a2.id); // shared across users and casing
  assert.deepEqual(t.models.InterviewPrep.rows.map((r) => r.companyKey), ['general', 'general']);
  assert.notEqual(t.models.InterviewPrep.rows[0].roleKey, t.models.InterviewPrep.rows[1].roleKey);
  assert.equal(t.researchCalls[0].company, '');
  assert.equal(t.researchCalls[0].level, 'senior');
  await assert.rejects(t.service.start({ company: '', jobTitle: 'Frontend Developer' }), (e) => e.status === 400);
  await assert.rejects(t.service.start({ company: 'Acme', jobTitle: '' }), (e) => e.status === 400);
});

test('role scope: POST returns prep with company empty and scope role; cached payload without scope still reports one', async () => {
  const t = await setup();
  const first = await t.call('/', { jobTitle: 'Frontend Developer', level: 'senior', source: 'role' });
  assert.equal(first.status, 200);
  await t.service.whenIdle();
  const second = await t.call('/', { jobTitle: 'Frontend Developer', level: 'senior', source: 'role' });
  assert.equal(second.body.status, 'ready');
  assert.equal(second.body.prep.company, '');
  assert.equal(second.body.prep.scope, 'role');
  assert.equal(second.body.prep.level, 'senior');
  t.models.InterviewPrep.rows[0].payload = PAYLOAD({ company: 'Acme' }); // an old row with no scope
  const old = await t.call(`/${first.body.id}`);
  t.close();
  assert.equal(old.body.prep.scope, 'company');
});

test('company preps still behave as before', async () => {
  const t = await setup();
  const r = await t.call('/', { company: 'Acme Inc', jobTitle: 'Engineer' });
  await t.service.whenIdle();
  const row = t.models.InterviewPrep.rows[0];
  t.close();
  assert.equal(r.status, 200);
  assert.equal(row.companyKey, 'acme');
  assert.equal(row.roleKey, 'engineer');
  assert.equal(row.status, 'ready');
  assert.equal(row.payload.scope, 'company');
});

/* ---------- history ---------- */

test('history: POST records an upsert, validates source, drops a tailored id the user does not own', async () => {
  const t = await setup();
  await t.call('/', { company: 'Acme', jobTitle: 'Engineer', tailoredProfileId: UUID(7) });
  await t.call('/', { company: 'Acme', jobTitle: 'Engineer', source: 'bogus' });
  await t.call('/', { company: 'Globex', jobTitle: 'Dev', tailoredProfileId: UUID(7), source: 'text' }, 'u2');
  await t.call('/', { company: '', jobTitle: 'Frontend Developer', level: 'senior', source: 'role' });
  t.close();
  const rows = t.models.UserInterviewPrep.rows;
  assert.equal(rows.length, 3); // second call upserted the first
  const acme = rows.find((r) => r.label === 'Engineer at Acme');
  assert.equal(acme.source, 'tailored'); // kept the tailored id from the first call; bogus source falls back
  assert.equal(acme.tailoredProfileId, UUID(7));
  const other = rows.find((r) => r.userId === 'u2');
  assert.equal(other.tailoredProfileId, null);
  assert.equal(other.source, 'text');
  assert.equal(rows.find((r) => r.source === 'role').label, 'senior Frontend Developer');
});

test('history: a failing history write never fails the request', async () => {
  const t = await setup();
  t.models.UserInterviewPrep.findOne = async () => { throw new Error('db down'); };
  const r = await t.call('/', { company: 'Acme', jobTitle: 'Engineer' });
  t.close();
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
});

test('mine: own preps only, newest first, story counts, contract shape; opening bumps lastOpenedAt', async () => {
  const t = await setup();
  const a = await t.call('/', { company: 'Acme', jobTitle: 'Engineer' });
  await t.service.whenIdle();
  const b = await t.call('/', { jobTitle: 'Frontend Developer', level: 'senior', source: 'role' });
  await t.service.whenIdle();
  await t.call('/', { company: 'Globex', jobTitle: 'Dev' }, 'u2');
  await t.service.whenIdle();
  const mine = t.models.UserInterviewPrep.rows.filter((r) => r.userId === 'u1');
  mine.find((r) => r.prepId === a.body.id).lastOpenedAt = new Date('2026-01-01');
  mine.find((r) => r.prepId === b.body.id).lastOpenedAt = new Date('2026-06-01');
  t.models.InterviewStory.rows.push({ id: UUID(1), userId: 'u1', prepId: a.body.id }, { id: UUID(2), userId: 'u1', prepId: a.body.id }, { id: UUID(3), userId: 'u2', prepId: a.body.id });
  const r = await t.call('/mine');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.preps.map((p) => p.id), [b.body.id, a.body.id]);
  assert.deepEqual(Object.keys(r.body.preps[0]).sort(), ['company', 'generatedAt', 'id', 'lastOpenedAt', 'level', 'role', 'scope', 'status', 'storyCount', 'tailoredProfileId']);
  assert.equal(r.body.preps[0].scope, 'role');
  assert.equal(r.body.preps[0].company, '');
  assert.equal(r.body.preps[1].scope, 'company');
  assert.equal(r.body.preps[1].company, 'Acme');
  assert.equal(r.body.preps[1].storyCount, 2); // u2's story is not counted
  assert.equal(r.body.preps[0].storyCount, 0);
  const u3 = await t.call('/mine', null, 'u3');
  assert.deepEqual(u3.body.preps, []);

  const before = mine.find((x) => x.prepId === a.body.id).lastOpenedAt;
  await t.call(`/${a.body.id}`);
  await new Promise((res) => setTimeout(res, 10));
  t.close();
  assert.ok(mine.find((x) => x.prepId === a.body.id).lastOpenedAt > before);
});

test('mine: capped at 30', async () => {
  const t = await setup();
  for (let i = 0; i < 32; i += 1) {
    const row = await t.models.InterviewPrep.create({ companyKey: `c${i}`, roleKey: 'r', status: 'ready', payload: PAYLOAD() });
    await t.models.UserInterviewPrep.create({ userId: 'u1', prepId: row.id, source: 'link', label: 'x', lastOpenedAt: new Date(2026, 0, i + 1) });
  }
  const r = await t.call('/mine');
  t.close();
  assert.equal(r.body.preps.length, 30);
});

/* ---------- personalize and stories without a tailored profile, role scope ---------- */

test('role-scope prep: personalize and stories fall back to the Profile; prompts never say "at undefined" or "at "', async () => {
  const t = await setup();
  const created = await t.call('/', { jobTitle: 'Frontend Developer', level: 'senior', source: 'role' });
  await t.service.whenIdle();
  const prompts = [];
  const capture = async (a) => {
    prompts.push(a);
    if (a.purpose === 'personalize') return JSON.stringify({ probes: [1, 2, 3, 4].map((i) => ({ question: `Q${i}`, why: 'w', basedOn: 'Equinix' })) });
    if (a.purpose === 'story_questions') return JSON.stringify({ questions: [{ question: 'What was the real problem you were solving?', hint: '' }, { question: 'How was it built and why that way?', hint: '' }, { question: 'What was hardest and how did you solve it?', hint: '' }] });
    return JSON.stringify({ spoken: `${Array.from({ length: 120 }, (_, i) => `w${i}`).join(' ')}`, beats: [{ label: 'The situation', text: 'x' }], tips: ['t'], needsYou: [] });
  };
  // The route passes its own models; drive the same paths through the HTTP layer with a capturing story model.
  const id = created.body.id;
  const pers = await t.call(`/${id}/personalize`, {});
  assert.equal(pers.status, 200);
  assert.equal(pers.body.probes.length, 4);
  const prep = t.models.InterviewPrep.rows[0].payload;
  assert.equal(prep.company, '');
  const profile = { title: 'Engineer', experience: [{ company: 'Equinix' }] };
  await storyQuestions({ prep, profile, theme: 'Scale', title: 'Billing', experienceRef: {}, runModel: capture });
  await writeStory({ prep, profile, theme: 'Scale', title: 'Billing', experienceRef: { company: 'Equinix' }, details: '', answers: [], runModel: capture });
  t.close();
  assert.ok(prompts.length >= 2);
  for (const a of prompts) {
    assert.ok(!/at undefined/.test(a.prompt), a.prompt);
    assert.ok(!/ at (\n|$)/.test(a.prompt), a.prompt);
    assert.match(a.prompt, /(Preparing for|Interview): Frontend Developer\n/);
  }
  void suggestTopics;
});

test('stories routes accept a role-scope prep with no tailoredProfileId', async () => {
  const t = await setup();
  const created = await t.call('/', { jobTitle: 'Frontend Developer', level: 'senior' });
  await t.service.whenIdle();
  const topics = await t.call(`/${created.body.id}/stories/topics`, {});
  t.close();
  // the injected model returns the parse-job JSON, so topics fail to parse; what matters is the profile fallback ran (no 422 profile_empty, no 404)
  assert.notEqual(topics.status, 404);
  assert.notEqual(topics.body.code, 'profile_empty');
  assert.notEqual(topics.body.code, 'not_ready');
});
