const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { buildRouter } = require('../routes/interviewPrep');
const { makeInterviewPrepService } = require('./interviewPrepService');

const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PREP_ID = UUID(1);
const PAYLOAD = { company: 'Acme', role: 'Engineer', coverage: 'good', topics: [{ name: 'Scale', why: 'w' }], questions: [{ text: 'Tell me about scaling', category: 'behavioral' }] };
const ref = { company: 'Equinix', role: 'SRE', period: '2020', project: 'Billing' };
const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

function fakeStoryModel() {
  const rows = [];
  const wrap = (data) => {
    const row = { createdAt: new Date(), updatedAt: new Date(), ...data };
    row.update = async (patch) => Object.assign(row, patch);
    row.destroy = async () => { rows.splice(rows.indexOf(row), 1); };
    return row;
  };
  const match = (r, where) => Object.entries(where).every(([k, v]) => r[k] === v);
  return {
    rows,
    create: async (d) => { const r = wrap({ id: UUID(100 + rows.length), ...d }); rows.push(r); return r; },
    findAll: async ({ where }) => rows.filter((r) => match(r, where)).reverse(),
    findOne: async ({ where }) => rows.find((r) => match(r, where)) || null,
  };
}

async function setup({ user = { id: 'u1', role: 'candidate', subscriptionTier: 'pro' }, ready = true } = {}) {
  const prepRow = { id: PREP_ID, companyKey: 'acme', roleKey: 'engineer', status: ready ? 'ready' : 'pending', payload: PAYLOAD, update: async () => {} };
  const service = makeInterviewPrepService({ InterviewPrep: { findByPk: async (id) => (id === PREP_ID ? prepRow : null) }, getResearch: () => async () => PAYLOAD });
  const InterviewStory = fakeStoryModel();
  const models = {
    InterviewStory,
    TailoredProfile: { findOne: async () => null },
    Profile: { findOne: async () => ({ toJSON: () => ({ title: 'Engineer', experience: [{ company: 'Equinix' }] }) }) },
  };
  const usage = [];
  const modelCalls = [];
  const storyModel = async (a) => {
    modelCalls.push(a);
    if (a.purpose === 'story_questions') {
      return JSON.stringify({ questions: [{ question: 'What was the real problem you were solving?', hint: 'for example slow pages' }, { question: 'How was it built: client-side or server-side rendering, and why?', hint: 'say what you chose' }, { question: 'What was the hardest part and how did you solve it?', hint: '' }] });
    }
    if (a.purpose === 'story_topics') {
      const t = (n) => ({ title: n, angle: 'a', experienceRef: ref });
      return JSON.stringify({ topics: [{ theme: 'Scaling', why: 'w', questions: ['q'], titles: [t('A'), t('B'), t('C')] }] });
    }
    return JSON.stringify({ spoken: `${words(120)} [your number]`, beats: [{ label: 'The situation', text: 'x' }], tips: ['t'], needsYou: [] });
  };
  const app = express();
  app.use(express.json());
  const auth = (req, res, next) => { const id = req.headers['x-user'] || user.id; req.user = { ...user, id }; next(); };
  app.use('/api/interview-prep', buildRouter({
    service, authMiddleware: auth, limiter: (q, r, n) => n(), storyLimiter: (q, r, n) => n(),
    recordUsage: async (u, f) => usage.push([u, f]), runModel: async () => '{}', storyModel, models,
  }));
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/interview-prep`;
  const call = async (path, body, method, uid) => {
    const res = await fetch(base + path, { method: method || (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(uid ? { 'x-user': uid } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  return { call, InterviewStory, usage, modelCalls, close: () => server.close() };
}

test('free tier gets 403 upgrade_required on topics and write; no model call', async () => {
  const t = await setup({ user: { id: 'u1', role: 'candidate', subscriptionTier: 'free' } });
  try {
    for (const [path, body] of [[`/${PREP_ID}/stories/topics`, {}], [`/${PREP_ID}/stories`, { title: 'x', theme: 'y', experienceRef: ref }]]) {
      const r = await t.call(path, body);
      assert.equal(r.status, 403);
      assert.equal(r.body.code, 'upgrade_required');
      assert.equal(r.body.upgradeRequired, true);
      assert.equal(r.body.message, 'Interview stories are part of Pro.');
    }
    assert.equal(t.modelCalls.length, 0);
    assert.equal((await t.call(`/${PREP_ID}/stories`)).status, 200); // GET is not gated
  } finally { t.close(); }
});

test('admin passes the gate; topics then write saves and meters career_suggestions', async () => {
  const t = await setup({ user: { id: 'u1', role: 'admin', subscriptionTier: 'free' } });
  try {
    const tp = await t.call(`/${PREP_ID}/stories/topics`, {});
    assert.equal(tp.status, 200);
    assert.equal(tp.body.topics[0].titles.length, 3);
    const w = await t.call(`/${PREP_ID}/stories`, { theme: 'Scaling', title: 'A', experienceRef: ref });
    assert.equal(w.status, 200);
    const s = w.body.story;
    assert.deepEqual(Object.keys(s).sort(), ['beats', 'createdAt', 'experienceRef', 'id', 'needsYou', 'spoken', 'theme', 'tips', 'title']);
    assert.equal(s.needsYou.length, 1);
    assert.equal(t.InterviewStory.rows.length, 1);
    assert.deepEqual(t.usage.map((u) => u[1]), ['career_suggestions', 'career_suggestions']);
    const list = await t.call(`/${PREP_ID}/stories`);
    assert.equal(list.body.stories.length, 1);
  } finally { t.close(); }
});

test('not ready is 409, bad or unknown ids are 404, missing title is 400', async () => {
  const t = await setup({ ready: false });
  try {
    assert.equal((await t.call(`/${PREP_ID}/stories/topics`, {})).status, 409);
    assert.equal((await t.call(`/${UUID(9)}/stories/topics`, {})).status, 404);
    assert.equal((await t.call('/nope/stories/topics', {})).status, 404);
  } finally { t.close(); }
  const t2 = await setup();
  try { assert.equal((await t2.call(`/${PREP_ID}/stories`, { theme: 'x' })).status, 400); } finally { t2.close(); }
});

test('PATCH and DELETE are own-only; edits are cleaned', async () => {
  const t = await setup();
  try {
    const w = await t.call(`/${PREP_ID}/stories`, { theme: 'S', title: 'A', experienceRef: ref });
    const id = w.body.story.id;
    assert.equal((await t.call(`/${PREP_ID}/stories/${id}`, { spoken: 'x' }, 'PATCH', 'other')).status, 404);
    assert.equal((await t.call(`/${PREP_ID}/stories/${id}`, undefined, 'DELETE', 'other')).status, 404);
    assert.equal((await t.call(`/${PREP_ID}/stories`, undefined, 'GET', 'other')).body.stories.length, 0);
    const p = await t.call(`/${PREP_ID}/stories/${id}`, { spoken: 'I did it — then left' }, 'PATCH');
    assert.equal(p.status, 200);
    assert.equal(p.body.story.spoken, 'I did it, then left');
    assert.equal((await t.call(`/${PREP_ID}/stories/${id}`, undefined, 'DELETE')).body.success, true);
    assert.equal(t.InterviewStory.rows.length, 0);
    assert.equal((await t.call(`/${PREP_ID}/stories/${id}`, { spoken: 'x' }, 'PATCH')).status, 404);
  } finally { t.close(); }
});

test('questions: paid only, no allowance used, and the answers reach the story prompt', async () => {
  const free = await setup({ user: { id: 'u1', role: 'candidate', subscriptionTier: 'free' } });
  const denied = await free.call(`/${PREP_ID}/stories/questions`, { title: 'x', theme: 'y', experienceRef: ref });
  assert.equal(denied.status, 403);
  assert.equal(free.modelCalls.length, 0);
  free.close();

  const t = await setup();
  const qs = await t.call(`/${PREP_ID}/stories/questions`, { title: 'The slow billing pages at Equinix', theme: 'Performance', experienceRef: ref });
  assert.equal(qs.status, 200);
  assert.equal(qs.body.questions.length, 3);
  assert.deepEqual(qs.body.questions.map((q) => q.id), ['q1', 'q2', 'q3']);
  assert.equal(t.usage.length, 0); // asking does not use an allowance
  const written = await t.call(`/${PREP_ID}/stories`, { title: 'The slow billing pages at Equinix', theme: 'Performance', experienceRef: ref, answers: [{ question: 'How was it built?', answer: 'We moved to server-side rendering with Next.js' }, { question: 'Skipped?', answer: '   ' }] });
  assert.equal(written.status, 200);
  const prompt = t.modelCalls.find((c) => c.purpose === 'story_write').prompt;
  assert.match(prompt, /server-side rendering with Next\.js/);
  assert.doesNotMatch(prompt, /Skipped\?/);
  assert.equal(t.usage.length, 1); // the write uses one
  t.close();
});
