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
    { text: 'What is the virtual DOM and why does it help?', category: 'role_specific', frequency: 4 },
    { text: 'How does the event loop work?', category: 'coding', frequency: 2 },
  ],
  topics: [{ name: 'React state management and hooks' }, { name: 'Communication and explanation skills' }, { name: 'Web performance' }],
};

PREP.questions.forEach((q, i) => { q.id = `q${i + 1}`; });

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

async function setup({ user = { id: 'u1', role: 'candidate', subscriptionTier: 'pro', firstName: 'Sam' }, ready = true, configured = true, limiter, storyModel, canUseStandalone, runModel } = {}) {
  const prepRow = { id: PREP_ID, companyKey: 'acme', roleKey: 'engineer', status: ready ? 'ready' : 'pending', payload: PREP, update: async function (p) { Object.assign(this, p); return this; } };
  const service = makeInterviewPrepService({ InterviewPrep: { findByPk: async (id) => (id === PREP_ID ? prepRow : null), findAll: async () => [prepRow] }, getResearch: () => async () => PREP });
  const InterviewStory = fakeModel();
  const InterviewPracticeSession = fakeModel();
  const InterviewCodeAttempt = fakeModel();
  const userPreps = [];
  const UserInterviewPrep = {
    findAll: async () => [{ prepId: PREP_ID, lastOpenedAt: new Date(), tailoredProfileId: null }],
    findOne: async ({ where }) => userPreps.find((r) => r.userId === where.userId && r.prepId === where.prepId) || null,
    create: async (v) => { const row = { ...v, update: async (p) => Object.assign(row, p) }; userPreps.push(row); return row; },
  };
  const models = {
    InterviewStory, InterviewPracticeSession, InterviewCodeAttempt, UserInterviewPrep,
    InterviewPrep: { findAll: async () => [prepRow], findByPk: async (id) => (id === PREP_ID ? prepRow : null) },
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
    recordUsage: async () => {}, runModel: runModel || (async () => '{}'), storyModel: storyModel || (async () => '{}'), models,
    realtime, recordVoice: async (...a) => { recorded.push(a); }, ...(canUseStandalone ? { canUseStandalone } : {}),
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

test('isRealQuestion keeps questions and drops headings about questions', () => {
  for (const t of [
    'What is lazy loading and how does it improve application performance?',
    'Describe how you would architect a content delivery solution for static assets.',
    'Design a scalable system for processing audio with AI.',
  ]) assert.equal(svc.isRealQuestion(t), true, t);
  for (const t of [
    'System design questions for full stack roles',
    'Frontend development coding and architecture questions',
    'React, CSS, and JavaScript implementation questions',
    'Hooks',
  ]) assert.equal(svc.isRealQuestion(t), false, t);
});

test('pickQuestions never picks a heading', () => {
  const prep = { questions: [
    { text: 'System design questions for full stack roles', category: 'system_design', frequency: 5 },
    { text: 'How would you handle slow API responses in your frontend?', category: 'system_design', frequency: 2 },
  ] };
  const picked = svc.pickQuestions({ prep });
  assert.deepEqual(picked.map((q) => q.text), ['How would you handle slow API responses in your frontend?']);
});

test('voice practice asks spoken questions only; code questions stay in the editor', () => {
  const qs = svc.pickQuestions({ prep: PREP });
  assert.ok(!qs.some((q) => /linked list|islands/.test(q.text)));
  assert.ok(qs.some((q) => /virtual DOM/.test(q.text)));
  assert.equal(svc.questionKind({ text: 'Implement a debounce function', category: 'coding' }), 'code');
  assert.equal(svc.questionKind({ text: 'How does the event loop work?', category: 'coding' }), 'spoken');
  assert.equal(svc.questionKind({ text: 'Design a feed', category: 'system_design' }), 'spoken');
});

test('thin research is filled with knowledge questions from the review topics, never from soft skills', () => {
  const prep = { role: 'Staff frontend engineer', questions: [{ text: 'Tell me about a conflict with a teammate', category: 'behavioral', frequency: 1 }], topics: [{ name: 'React state management and hooks' }, { name: 'Communication and explanation skills' }, { name: 'Web performance' }] };
  const qs = svc.pickQuestions({ prep });
  assert.deepEqual(qs.map((q) => q.text), [
    'Tell me about a conflict with a teammate',
    'Explain React state management and hooks in your own words, and say when you have used it or would reach for it.',
    'Explain Web performance in your own words, and say when you have used it or would reach for it.',
  ]);
});

test('the reported-for tail is not spoken aloud', () => {
  assert.equal(svc.stripReported('Design a scalable system for processing audio with AI (reported for a technical phone screen).'), 'Design a scalable system for processing audio with AI');
  assert.equal(svc.stripReported('How do you use useMemo (and when not to)?'), 'How do you use useMemo (and when not to)?');
});

test('practiceInstructions mentions last time once, only when there is one', () => {
  const withLast = svc.practiceInstructions({ prep: PREP, questions: [{ text: 'Why Acme?' }], lastTime: { summary: 'You answered clearly but skipped numbers.', topTip: 'Add one number.' } });
  assert.match(withLast, /LAST TIME THEY PRACTICED THIS/);
  assert.match(withLast, /skipped numbers/);
  assert.doesNotMatch(svc.practiceInstructions({ prep: PREP, questions: [{ text: 'Why Acme?' }] }), /LAST TIME/);
});

const GOOD_REVIEW = JSON.stringify({
  verdict: 'good', summary: 'It solves the question — and reads clearly.', worked: ['Clear names'], issues: [{ what: 'Empty input returns undefined', fix: 'Return [] early' }],
  complexity: 'O(n) time, O(1) space', tips: ['Say the edge cases out loud'], improved: 'const f = (xs) => xs.map((x) => x * 2);',
});

test('code review: free tier is refused, a paid user gets a saved review, history is own only', async () => {
  const free = await setup({ user: { id: 'u1', role: 'candidate', subscriptionTier: 'free' } });
  try {
    const r = await free.call(`/${PREP_ID}/code/review`, { question: 'Double a list', code: 'const f = (xs) => xs;' });
    assert.equal(r.status, 403);
  } finally { free.close(); }

  const t = await setup({ storyModel: async () => GOOD_REVIEW });
  try {
    const r = await t.call(`/${PREP_ID}/code/review`, { question: 'Double a list', language: 'typescript', code: 'const f = (xs: number[]) => xs.map((x) => x);' });
    assert.equal(r.status, 200);
    assert.equal(r.body.attempt.review.verdict, 'good');
    assert.equal(r.body.attempt.language, 'typescript');
    assert.ok(!/[—–]/.test(r.body.attempt.review.summary));
    assert.equal(r.body.attempt.review.improved, 'const f = (xs) => xs.map((x) => x * 2);');
    const mine = await t.call(`/${PREP_ID}/code/attempts`);
    assert.equal(mine.body.attempts.length, 1);
    const other = await t.call(`/${PREP_ID}/code/attempts`, null, 'GET', 'someone-else');
    assert.equal(other.body.attempts.length, 0);
  } finally { t.close(); }
});

test('code review: too little code or no question is a 400, an unusable reply is a 422 and nothing is saved', async () => {
  const t = await setup({ storyModel: async () => 'not json at all' });
  try {
    assert.equal((await t.call(`/${PREP_ID}/code/review`, { question: 'Q', code: 'x' })).status, 400);
    assert.equal((await t.call(`/${PREP_ID}/code/review`, { code: 'const a = 1; const b = 2;' })).status, 400);
    const r = await t.call(`/${PREP_ID}/code/review`, { question: 'Double a list', code: 'const f = (xs) => xs;' });
    assert.equal(r.status, 422);
    assert.equal(r.body.code, 'review_failed');
    assert.equal((await t.call(`/${PREP_ID}/code/attempts`)).body.attempts.length, 0);
  } finally { t.close(); }
});

test('focus: saved per user, cleaned, and used to steer the practice questions and the coach', async () => {
  const t = await setup();
  try {
    assert.equal((await t.call(`/${PREP_ID}/focus`)).body.focus, null);
    const put = await t.call(`/${PREP_ID}/focus`, { areas: ['performance', 'nonsense', 'performance'], companyType: 'startup', worry: 'bogus' }, 'PUT');
    assert.equal(put.status, 200);
    assert.deepEqual(put.body.focus, { areas: ['performance'], companyType: 'startup', worry: '' });
    assert.deepEqual((await t.call(`/${PREP_ID}/focus`)).body.focus, put.body.focus);
    assert.equal((await t.call(`/${PREP_ID}/focus`, null, 'GET', 'someone-else')).body.focus, null);
    assert.equal((await t.call(`/${PREP_ID}/focus`, { areas: ['nope'] }, 'PUT')).body.focus, null);
  } finally { t.close(); }
});

test('standalone interview prep: closed to people without access, tailored and company preps keep working', async () => {
  const closed = await setup({ canUseStandalone: () => false });
  try {
    assert.equal((await closed.call('/mine')).status, 404);
    assert.equal((await closed.call('/parse-job', { text: 'Senior engineer at Acme' })).status, 404);
    const role = await closed.call('/', { company: '', jobTitle: 'Staff frontend engineer', level: 'staff' });
    assert.equal(role.status, 404);
    assert.equal(role.body.code, 'not_available');
    // a company prep (what Tailored profiles uses) is not part of the standalone section
    const company = await closed.call('/', { company: 'Acme', jobTitle: 'Engineer' });
    assert.notEqual(company.status, 404);
    // pages reached from a tailored resume keep working
    assert.equal((await closed.call(`/${PREP_ID}/focus`)).status, 200);
    assert.equal((await closed.call(`/${PREP_ID}/code/attempts`)).status, 200);
  } finally { closed.close(); }
  const open = await setup({ canUseStandalone: () => true });
  try {
    assert.equal((await open.call('/mine')).status, 200);
  } finally { open.close(); }
});

test('how to prepare: paid only, only for a real question, written once and kept on the shared prep', async () => {
  let calls = 0;
  const runModel = async () => { calls += 1; return JSON.stringify({ prepare: ['Know when React re-renders: state, props, parent.', 'Name memo and useCallback and when they do not help.', 'Say you would measure with the profiler first.'] }); };
  const free = await setup({ user: { id: 'u1', role: 'candidate', subscriptionTier: 'free' }, runModel });
  try { assert.equal((await free.call(`/${PREP_ID}/questions/q1/prepare`, {})).status, 403); } finally { free.close(); }
  const t = await setup({ runModel });
  try {
    assert.equal((await t.call(`/${PREP_ID}/questions/nope/prepare`, {})).status, 404);
    const first = await t.call(`/${PREP_ID}/questions/q1/prepare`, {});
    assert.equal(first.status, 200);
    assert.equal(first.body.prepare.length, 3);
    assert.equal(first.body.cached, false);
    const second = await t.call(`/${PREP_ID}/questions/q1/prepare`, {});
    assert.equal(second.body.cached, true);
    assert.deepEqual(second.body.prepare, first.body.prepare);
    assert.equal(calls, 1);
  } finally { t.close(); }
  const bad = await setup({ runModel: async () => 'nothing useful' });
  try {
    const r = await bad.call(`/${PREP_ID}/questions/q2/prepare`, {});
    assert.equal(r.status, 422);
    assert.equal(r.body.code, 'prepare_failed');
  } finally { bad.close(); }
});

test('suggested questions: paid only, a known kind, written once and reused, notes work for them, a job changes the cache', async () => {
  let calls = 0;
  const runModel = async () => {
    calls += 1;
    return JSON.stringify({ questions: [
      { text: 'What is a closure in JavaScript and when would you use one?', area: 'JavaScript', kind: 'spoken' },
      { text: 'Implement a debounce function', area: 'JavaScript', kind: 'code' },
    ] });
  };
  const free = await setup({ user: { id: 'u1', role: 'candidate', subscriptionTier: 'free' }, runModel });
  try { assert.equal((await free.call(`/${PREP_ID}/suggested`, { type: 'technical' })).status, 403); } finally { free.close(); }
  const t = await setup({ runModel });
  try {
    assert.equal((await t.call(`/${PREP_ID}/suggested`, { type: 'nope' })).status, 400);
    const first = await t.call(`/${PREP_ID}/suggested`, { type: 'technical' });
    assert.equal(first.status, 200);
    assert.equal(first.body.questions.length, 2);
    assert.equal(first.body.cached, false);
    const again = await t.call(`/${PREP_ID}/suggested`, { type: 'technical' });
    assert.equal(again.body.cached, true);
    assert.deepEqual(again.body.questions, first.body.questions);
    assert.equal(calls, 1);
    // a suggested question can get its how-to-prepare note
    const id = first.body.questions[0].id;
    const note = await t.call(`/${PREP_ID}/questions/${id}/prepare`, {});
    assert.notEqual(note.status, 404);
  } finally { t.close(); }
});
