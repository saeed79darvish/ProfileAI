const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { buildRouter } = require('../routes/interviewPrep');
const { makeInterviewPrepService } = require('./interviewPrepService');
const svc = require('./interviewPracticeService');

const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PREP_ID = UUID(1);
const bad = /[—–←-⇿]|-->|->/;
const PREP = {
  company: 'Acme', role: 'Engineer', coverage: 'good',
  questions: [
    { text: 'Design a rate limiter', category: 'system_design', frequency: 5 },
    { text: 'Reverse a linked list', category: 'coding', frequency: 4 },
    { text: 'Tell me about a conflict with a teammate', category: 'behavioral', frequency: 1 },
    { text: 'Why Acme?', category: 'other', frequency: 3 },
    { text: 'Explain our stack choices', category: 'role_specific', frequency: 2 },
    { text: 'Count the islands in a grid', category: 'coding', frequency: 2 },
  ],
};

test('pickQuestions: frequency first, mixed categories, includes a behavioral', () => {
  const qs = svc.pickQuestions({ prep: PREP });
  assert.equal(qs.length, 5);
  assert.deepEqual(qs.map((q) => q.id), ['p1', 'p2', 'p3', 'p4', 'p5']);
  assert.ok(qs.every((q) => q.kind === 'reported'));
  assert.ok(qs.some((q) => /conflict/.test(q.text)));
  assert.equal(qs[0].text, 'Design a rate limiter');
  assert.equal(new Set(qs.map((q) => q.text)).size, 5);
});

test('pickQuestions: adds up to two resume probes, never more than five total', () => {
  const qs = svc.pickQuestions({ prep: PREP, resumeProbes: [{ question: 'You cut latency at Equinix, how?' }, 'Walk me through the billing project', { question: 'third probe is dropped' }] });
  assert.equal(qs.length, 5);
  assert.equal(qs.filter((q) => q.kind === 'resume').length, 2);
});

test('pickQuestions: requested list is cleaned and used, nothing invented', () => {
  const qs = svc.pickQuestions({ prep: PREP, requested: [
    { text: '  Tell me   about yourself  ', kind: 'reported' }, { text: 'tell me about yourself', kind: 'resume' },
    { text: 'short' }, { text: 'x'.repeat(301) }, { text: 42 }, null, { text: 'Describe your best project', kind: 'resume' },
  ] });
  assert.deepEqual(qs.map((q) => [q.text, q.kind]), [['Tell me about yourself', 'reported'], ['Describe your best project', 'resume']]);
  const many = svc.pickQuestions({ prep: PREP, requested: Array.from({ length: 12 }, (_, i) => ({ text: `Question number ${i} here` })) });
  assert.equal(many.length, 8);
  assert.deepEqual(svc.pickQuestions({ prep: { questions: [] } }), []);
});

test('practiceInstructions: questions in order, stories, rules, no em dash or arrow', () => {
  const questions = svc.pickQuestions({ prep: PREP });
  const text = svc.practiceInstructions({
    firstName: 'Sam', prep: PREP, questions, maxMinutes: 10, profileSnapshot: 'title: Engineer\nskills: Go',
    stories: [{ title: 'Billing rewrite', theme: 'Ownership', spoken: 'I led it — and it shipped. '.repeat(100) }],
  });
  assert.match(text, /Engineer at Acme/);
  assert.match(text, /5 questions/);
  const positions = questions.map((q, i) => text.indexOf(`${i + 1}. ${q.text}`));
  assert.ok(positions.every((p) => p > 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.match(text, /ONE question at a time/);
  assert.match(text, /record_feedback/);
  assert.match(text, /finish_session/);
  assert.match(text, /wrap up/i);
  assert.match(text, /Billing rewrite/);
  assert.match(text, /Never read the story aloud/);
  assert.match(text, /title: Engineer/);
  assert.ok(!bad.test(text));
  const story = text.split('\n').find((l) => l.startsWith('- Billing rewrite'));
  assert.ok(story.length < 700 + 100);
  const noCompany = svc.practiceInstructions({ prep: { role: 'Engineer' }, questions });
  assert.ok(!/ at undefined|Engineer at /.test(noCompany));
});

test('instructions put the spoken goodbye before finish_session, and feedback before record_feedback', () => {
  const text = svc.practiceInstructions({ prep: PREP, questions: svc.pickQuestions({ prep: PREP }) });
  const end = text.split('\n').find((l) => l.startsWith('- To end'));
  assert.ok(end.indexOf('goodbye') < end.indexOf('CALL the tool finish_session'));
  assert.match(end, /Never speak after calling finish_session/);
  const fb = text.split('\n').find((l) => l.includes('record_feedback'));
  assert.ok(fb.indexOf('Speak the feedback first') < fb.indexOf('CALL the tool record_feedback'));
  assert.ok(!bad.test(text));
});

test('tool definitions have the realtime function shape', () => {
  const [fb, fin] = svc.PRACTICE_TOOLS;
  for (const t of svc.PRACTICE_TOOLS) { assert.equal(t.type, 'function'); assert.equal(t.parameters.type, 'object'); }
  assert.equal(fb.name, 'record_feedback');
  assert.deepEqual(Object.keys(fb.parameters.properties), ['questionIndex', 'question', 'worked', 'improve', 'usedStory', 'hadNumbers']);
  assert.deepEqual(fb.parameters.required, Object.keys(fb.parameters.properties));
  assert.equal(fb.parameters.properties.questionIndex.type, 'integer');
  assert.equal(fb.parameters.properties.usedStory.type, 'boolean');
  assert.equal(fin.name, 'finish_session');
  assert.deepEqual(fin.parameters.required, ['summary', 'topTip']);
});

test('cleanNotes and cleanSummary trim, cap, coerce and scrub', () => {
  const notes = svc.cleanNotes([
    { questionIndex: '2', question: ' Q ', worked: 'Clear — crisp', improve: 'Add a number -> done', usedStory: 'true', hadNumbers: 1 },
    { worked: 'w'.repeat(500), improve: 'i' }, 'junk', null, {},
    ...Array.from({ length: 12 }, (_, i) => ({ question: `q${i}`, worked: 'a', improve: 'b' })),
  ]);
  assert.equal(notes.length, 8);
  assert.deepEqual(notes[0], { questionIndex: 2, question: 'Q', worked: 'Clear, crisp', improve: 'Add a number done', usedStory: true, hadNumbers: false });
  assert.equal(notes[1].worked.length, 300);
  assert.equal(notes[1].questionIndex, 2);
  assert.deepEqual(svc.cleanNotes('nope'), []);
  const s = svc.cleanSummary({ summary: 's'.repeat(900), topTip: ` Tip — now ` });
  assert.equal(s.summary.length, 500);
  assert.equal(s.topTip, 'Tip, now');
});

function fakeModel(extra = {}) {
  const rows = [];
  const match = (r, where) => Object.entries(where).every(([k, v]) => r[k] === v);
  return {
    rows,
    create: async (d) => { const r = { id: UUID(500 + rows.length), createdAt: new Date(2026, 0, 1, 0, rows.length), ...d }; rows.push(r); return r; },
    findAll: async ({ where, limit }) => rows.filter((r) => match(r, where) || (Array.isArray(where.prepId) && r.userId === where.userId && where.prepId.includes(r.prepId))).reverse().slice(0, limit || 1000),
    findOne: async ({ where }) => rows.find((r) => match(r, where)) || null,
    ...extra,
  };
}

async function setup({ user = { id: 'u1', role: 'candidate', subscriptionTier: 'pro', firstName: 'Sam' }, ready = true, configured = true, limiter } = {}) {
  const prepRow = { id: PREP_ID, companyKey: 'acme', roleKey: 'engineer', status: ready ? 'ready' : 'pending', payload: PREP, update: async () => {} };
  const service = makeInterviewPrepService({ InterviewPrep: { findByPk: async (id) => (id === PREP_ID ? prepRow : null), findAll: async () => [prepRow] }, getResearch: () => async () => PREP });
  const InterviewStory = fakeModel();
  const InterviewPracticeSession = fakeModel();
  const UserInterviewPrep = { findAll: async () => [{ prepId: PREP_ID, lastOpenedAt: new Date(), tailoredProfileId: null }] };
  const models = {
    InterviewStory, InterviewPracticeSession, UserInterviewPrep,
    InterviewPrep: { findAll: async () => [prepRow] },
    TailoredProfile: { findOne: async () => null },
    Profile: { findOne: async () => ({ toJSON: () => ({ title: 'Engineer', skills: ['Go'] }) }) },
  };
  const realtimeCalls = [];
  const recorded = [];
  const realtime = {
    isConfigured: () => configured,
    createRealtimeSession: async (a) => { realtimeCalls.push(a); return { clientSecret: 'ek_x', expiresAt: 123, model: 'm', sessionId: 's1' }; },
  };
  const app = express();
  app.use(express.json());
  const auth = (req, res, next) => { const id = req.headers['x-user'] || user.id; req.user = { ...user, id }; next(); };
  app.use('/api/interview-prep', buildRouter({
    service, authMiddleware: auth, limiter: (q, r, n) => n(), storyLimiter: (q, r, n) => n(),
    recordUsage: async () => {}, runModel: async () => '{}', storyModel: async () => '{}', models,
    realtime, recordVoice: async (...a) => { recorded.push(a); },
    voiceLimiter: limiter || ((req, res, next) => { req.voiceAllowance = { allowed: true, maxSessionMinutes: 10 }; next(); }),
  }));
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/interview-prep`;
  const call = async (path, body, method, uid) => {
    const res = await fetch(base + path, { method: method || (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(uid ? { 'x-user': uid } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  return { call, models, realtimeCalls, recorded, close: () => server.close() };
}

test('practice session: free tier gets 403 upgrade_required, nothing opened', async () => {
  const t = await setup({ user: { id: 'u1', role: 'candidate', subscriptionTier: 'free' } });
  try {
    const r = await t.call(`/${PREP_ID}/practice/session`, {});
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'upgrade_required');
    assert.equal(t.realtimeCalls.length, 0);
  } finally { t.close(); }
});

test('practice session: limiter 429 passes through untouched', async () => {
  const body = { error: 'Voice limit reached', featureType: 'voice_coach', reason: 'minutes_used', upgradeRequired: true, buyMoreUrl: '/pricing' };
  const t = await setup({ limiter: (req, res) => res.status(429).json(body) });
  try {
    const r = await t.call(`/${PREP_ID}/practice/session`, {});
    assert.equal(r.status, 429);
    assert.deepEqual(r.body, body);
    assert.equal(t.realtimeCalls.length, 0);
    assert.equal(t.recorded.length, 0);
  } finally { t.close(); }
});

test('practice session: 409 not ready, 404 foreign or malformed, 503 not configured', async () => {
  let t = await setup({ ready: false });
  try { assert.equal((await t.call(`/${PREP_ID}/practice/session`, {})).status, 409); } finally { t.close(); }
  t = await setup();
  try {
    assert.equal((await t.call(`/${UUID(9)}/practice/session`, {})).status, 404);
    assert.equal((await t.call('/not-a-uuid/practice/session', {})).status, 404);
    assert.equal((await t.call(`/${PREP_ID}/practice/session`, { tailoredProfileId: UUID(7) })).status, 404);
  } finally { t.close(); }
  t = await setup({ configured: false });
  try {
    const r = await t.call(`/${PREP_ID}/practice/session`, {});
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'Voice is not configured on this server');
  } finally { t.close(); }
});

test('practice session: opens realtime with instructions, tools, stories; records minutes', async () => {
  const t = await setup();
  try {
    await t.models.InterviewStory.create({ userId: 'u1', prepId: PREP_ID, title: 'Billing rewrite', theme: 'Ownership', spoken: 'I led the billing rewrite.' });
    await t.models.InterviewStory.create({ userId: 'other', prepId: PREP_ID, title: 'Secret story', spoken: 'nope' });
    const r = await t.call(`/${PREP_ID}/practice/session`, {});
    assert.equal(r.status, 200);
    assert.equal(r.body.success, true);
    assert.equal(r.body.clientSecret, 'ek_x');
    assert.equal(r.body.sessionId, 's1');
    assert.equal(r.body.maxSessionMinutes, 10);
    assert.equal(r.body.questions.length, 5);
    assert.equal(r.body.questions[0].id, 'p1');
    const call = t.realtimeCalls[0];
    assert.deepEqual(call.tools, svc.PRACTICE_TOOLS);
    assert.match(call.instructions, /Billing rewrite/);
    assert.ok(!/Secret story/.test(call.instructions));
    assert.match(call.instructions, /title: Engineer/);
    assert.deepEqual(t.recorded[0].slice(0, 2), ['u1', 10]);
    assert.equal(t.recorded[0][2].feature, 'interview_practice');
    const own = await t.call(`/${PREP_ID}/practice/session`, { questions: [{ text: 'Tell me about yourself', kind: 'reported' }] });
    assert.deepEqual(own.body.questions.map((q) => q.text), ['Tell me about yourself']);
  } finally { t.close(); }
});

test('save and list sessions: roundtrip, own only, validation, clamp', async () => {
  const t = await setup();
  try {
    const note = { questionIndex: 1, question: 'Q', worked: 'Clear — good', improve: 'Add numbers', usedStory: true, hadNumbers: false };
    assert.equal((await t.call(`/${PREP_ID}/practice/sessions`, { startedAt: new Date().toISOString(), seconds: 5000 })).status, 400);
    const saved = await t.call(`/${PREP_ID}/practice/sessions`, { startedAt: '2026-11-07T10:00:00Z', seconds: 5000, notes: [note], summary: 'Solid.', topTip: 'Lead with the result.' });
    assert.equal(saved.status, 200);
    assert.ok(saved.body.id);
    await t.call(`/${PREP_ID}/practice/sessions`, { seconds: -4, summary: 'Another' }, 'POST', 'u2');
    const list = await t.call(`/${PREP_ID}/practice/sessions`);
    assert.equal(list.body.sessions.length, 1);
    const s = list.body.sessions[0];
    assert.equal(s.id, saved.body.id);
    assert.equal(s.seconds, 3600);
    assert.equal(s.notes[0].worked, 'Clear, good');
    assert.equal(s.summary, 'Solid.');
    assert.deepEqual(Object.keys(s).sort(), ['createdAt', 'id', 'notes', 'seconds', 'startedAt', 'summary', 'topTip']);
    const other = await t.call(`/${PREP_ID}/practice/sessions`, null, 'GET', 'u2');
    assert.equal(other.body.sessions.length, 1);
    assert.equal(other.body.sessions[0].seconds, 0);
    assert.equal((await t.call(`/${UUID(9)}/practice/sessions`)).status, 404);
    assert.equal((await t.call('/bad/practice/sessions', { summary: 'x' })).status, 404);
  } finally { t.close(); }
});

test('mine carries practiceCount per prep', async () => {
  const t = await setup();
  try {
    await t.call(`/${PREP_ID}/practice/sessions`, { summary: 'One' });
    await t.call(`/${PREP_ID}/practice/sessions`, { summary: 'Two' });
    await t.call(`/${PREP_ID}/practice/sessions`, { summary: 'Theirs' }, 'POST', 'u2');
    const r = await t.call('/mine');
    assert.equal(r.status, 200);
    assert.equal(r.body.preps[0].practiceCount, 2);
  } finally { t.close(); }
});
