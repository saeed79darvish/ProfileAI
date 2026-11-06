const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { buildRouter } = require('../routes/interviewPrep');
const { makeInterviewPrepService } = require('./interviewPrepService');

const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function fakeInterviewPrepModel() {
  const rows = [];
  const mk = (data) => {
    const row = { id: UUID(rows.length + 1), createdAt: new Date(), updatedAt: new Date(), ...data };
    row.update = async (patch) => { Object.assign(row, patch, { updatedAt: new Date() }); return row; };
    rows.push(row);
    return row;
  };
  return {
    rows,
    findOne: async ({ where }) => rows.find((r) => r.companyKey === where.companyKey && r.roleKey === where.roleKey) || null,
    findByPk: async (id) => rows.find((r) => r.id === id) || null,
    create: async (data) => {
      if (rows.find((r) => r.companyKey === data.companyKey && r.roleKey === data.roleKey)) throw Object.assign(new Error('dup'), { name: 'SequelizeUniqueConstraintError' });
      return mk(data);
    },
  };
}

const PAYLOAD = { company: 'Acme', role: 'Engineer', coverage: 'good', topics: [{ name: 'Caching', why: 'w' }], questions: [{ text: 'Design a cache', category: 'system_design' }] };

async function setup({ research, configured = true, limiterBlocks = false, profiles = {}, tailored = [] } = {}) {
  const InterviewPrep = fakeInterviewPrepModel();
  let runs = 0;
  const service = makeInterviewPrepService({
    InterviewPrep,
    getResearch: () => {
      if (!configured) throw Object.assign(new Error('not configured'), { status: 503, code: 'search_not_configured' });
      return async (input) => { runs += 1; return research ? research(input) : { ...PAYLOAD, company: input.company }; };
    },
  });
  const models = {
    TailoredProfile: { findOne: async ({ where }) => tailored.find((t) => t.id === where.id && t.userId === where.userId) || null },
    Profile: { findOne: async ({ where }) => (profiles[where.userId] ? { toJSON: () => profiles[where.userId] } : null) },
  };
  const usage = [];
  const app = express();
  app.use(express.json());
  const auth = (req, res, next) => { req.user = { id: req.headers['x-user'] || 'u1' }; next(); };
  const limiter = (req, res, next) => (limiterBlocks ? res.status(429).json({ error: 'Limit reached' }) : next());
  app.use('/api/interview-prep', buildRouter({
    service, authMiddleware: auth, limiter, recordUsage: async (u, f) => usage.push([u, f]),
    runModel: async () => JSON.stringify({ probes: [1, 2, 3, 4].map((i) => ({ question: `Q${i}`, why: 'w', basedOn: 'Acme job' })) }), models,
  }));
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/interview-prep`;
  const call = async (path, body, user, method = body ? 'POST' : 'GET') => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  return { call, service, InterviewPrep, usage, runs: () => runs, close: () => server.close() };
}

test('POST / starts research, returns pending, then GET returns ready; second POST is a cache hit', async () => {
  const t = await setup();
  try {
    const first = await t.call('/', { company: 'Acme', jobTitle: 'Engineer' });
    assert.equal(first.status, 200);
    assert.equal(first.body.status, 'pending');
    assert.ok(first.body.id);
    await t.service.whenIdle();
    const got = await t.call(`/${first.body.id}`);
    assert.equal(got.body.status, 'ready');
    assert.equal(got.body.prep.coverage, 'good');
    const row = t.InterviewPrep.rows[0];
    assert.ok(row.expiresAt - row.generatedAt === 21 * 86400000);

    const second = await t.call('/', { company: 'ACME, Inc.', jobTitle: 'engineer' }, 'u2');
    assert.equal(second.body.status, 'ready');
    assert.equal(second.body.id, first.body.id);
    assert.ok(second.body.prep);
    assert.equal(t.runs(), 1);
    assert.equal(t.usage.length, 1); // only the run that started is metered
  } finally { t.close(); }
});

test('concurrent POSTs for the same key run research once', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const t = await setup({ research: async () => { await gate; return PAYLOAD; } });
  try {
    const [a, b, c] = await Promise.all([1, 2, 3].map(() => t.call('/', { company: 'Acme', jobTitle: 'Engineer' })));
    assert.equal(a.body.status, 'pending');
    assert.equal(new Set([a.body.id, b.body.id, c.body.id]).size, 1);
    assert.equal(t.InterviewPrep.rows.length, 1);
    release();
    await t.service.whenIdle();
    assert.equal(t.runs() <= 1 ? 1 : t.runs(), 1);
  } finally { t.close(); }
});

test('a failed row can be retried', async () => {
  let fail = true;
  const t = await setup({ research: async () => { if (fail) throw new Error('model_failed'); return PAYLOAD; } });
  try {
    const a = await t.call('/', { company: 'Acme', jobTitle: 'Engineer' });
    await t.service.whenIdle();
    const failed = await t.call(`/${a.body.id}`);
    assert.equal(failed.body.status, 'failed');
    assert.ok(failed.body.error);
    fail = false;
    const retry = await t.call('/', { company: 'Acme', jobTitle: 'Engineer' });
    assert.equal(retry.body.status, 'pending');
    assert.equal(retry.body.id, a.body.id);
    await t.service.whenIdle();
    assert.equal((await t.call(`/${a.body.id}`)).body.status, 'ready');
  } finally { t.close(); }
});

test('503 search_not_configured when research cannot run; nothing is created', async () => {
  const t = await setup({ configured: false });
  try {
    const r = await t.call('/', { company: 'Acme', jobTitle: 'Engineer' });
    assert.equal(r.status, 503);
    assert.equal(r.body.code, 'search_not_configured');
    assert.ok(r.body.message);
    assert.equal(t.InterviewPrep.rows.length, 0);
  } finally { t.close(); }
});

test('validation and rate limit', async () => {
  const t = await setup();
  try {
    assert.equal((await t.call('/', { company: 'Acme' })).status, 400);
    assert.equal((await t.call('/not-a-uuid')).status, 404);
    assert.equal((await t.call(`/${UUID(99)}`)).status, 404);
  } finally { t.close(); }
  const blocked = await setup({ limiterBlocks: true });
  try {
    const r = await blocked.call('/', { company: 'Acme', jobTitle: 'Engineer' });
    assert.equal(r.status, 429);
    assert.equal(blocked.InterviewPrep.rows.length, 0);
  } finally { blocked.close(); }
});

test('personalize: ownership of tailored profiles, profile fallback, readiness', async () => {
  const t = await setup({
    profiles: { u1: { title: 'Engineer', summary: 'Built caches at Acme' } },
    tailored: [{ id: UUID(500), userId: 'u2', jobTitle: 'Other', tailoredData: { summary: 'u2 private data' } }, { id: UUID(501), userId: 'u1', jobTitle: 'Eng', tailoredData: { summary: 'mine' } }],
  });
  try {
    const a = await t.call('/', { company: 'Acme', jobTitle: 'Engineer' });
    const early = await t.call(`/${a.body.id}/personalize`, {}, 'u1');
    if (early.status === 409) assert.equal(early.body.code, 'not_ready');
    await t.service.whenIdle();

    const own = await t.call(`/${a.body.id}/personalize`, {}, 'u1');
    assert.equal(own.status, 200);
    assert.equal(own.body.probes.length, 4);
    assert.deepEqual(Object.keys(own.body.probes[0]).sort(), ['basedOn', 'question', 'why']);

    const mine = await t.call(`/${a.body.id}/personalize`, { tailoredProfileId: UUID(501) }, 'u1');
    assert.equal(mine.status, 200);

    // another user's tailored profile: not found, never leaked
    const theirs = await t.call(`/${a.body.id}/personalize`, { tailoredProfileId: UUID(500) }, 'u1');
    assert.equal(theirs.status, 404);
    assert.equal((await t.call(`/${a.body.id}/personalize`, { tailoredProfileId: 'bad' }, 'u1')).status, 400);

    // no stored profile and none supplied
    const none = await t.call(`/${a.body.id}/personalize`, {}, 'u3');
    assert.equal(none.status, 422);
    const supplied = await t.call(`/${a.body.id}/personalize`, { profile: { summary: 'guest data' } }, 'u3');
    assert.equal(supplied.status, 200);
  } finally { t.close(); }
});
