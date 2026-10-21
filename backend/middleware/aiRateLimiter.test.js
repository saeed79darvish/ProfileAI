/**
 * aiRateLimiter: the plan limits from the onboarding audit and the
 * freeWhen:'noProfileYet' exemption. Models are faked in memory, so this
 * never touches a database.
 *
 * Run: node --test middleware/aiRateLimiter.test.js
 */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const { AI_LIMITS, getLimits } = require('../config/aiLimits');

// ── In-memory models ────────────────────────────────────────────────────────
let users = {};
let profiles = {};
let usage = [];

const matches = (row, where) => Object.entries(where).every(([k, v]) => {
  if (v && typeof v === 'object' && Op.gte in v) return row[k] >= v[Op.gte];
  return row[k] === v;
});

const fakeModels = {
  User: { findByPk: async (id) => users[id] || null },
  Profile: { findOne: async ({ where }) => profiles[where.userId] || null },
  AIUsage: {
    count: async ({ where }) => usage.filter((r) => matches(r, where)).length,
    findAll: async ({ where }) => usage.filter((r) => matches(r, where)),
    create: async (row) => { usage.push(row); return row; },
  },
  PromoRedemption: { findAll: async () => [] },
  CreditPack: { findAll: async () => [], findOne: async () => null },
};

const modelsPath = require.resolve('../models');
require.cache[modelsPath] = { id: modelsPath, filename: modelsPath, loaded: true, exports: fakeModels };
const limiterPath = require.resolve('./aiRateLimiter');
delete require.cache[limiterPath];
const { aiRateLimiter, getVoiceAllowance } = require('./aiRateLimiter');

const run = async (mw, userId) => {
  const req = { user: { id: userId } };
  let status = 200;
  let body = null;
  let passed = false;
  const res = {
    status(code) { status = code; return this; },
    json(b) { body = b; return this; },
  };
  await mw(req, res, () => { passed = true; });
  return { passed, status, body, req };
};

const daysAgo = (n) => new Date(Date.now() - n * 86400000);

beforeEach(() => {
  users = {};
  profiles = {};
  usage = [];
});

// ── Config matches the approved plan ────────────────────────────────────────

test('plan: tailoring is 3 lifetime / 50 / 200, cover letters 2 / 30 / 200', () => {
  assert.equal(getLimits('candidate', 'free', 'tailor_profile').lifetime, 3);
  assert.equal(getLimits('candidate', 'pro', 'tailor_profile').monthly, 50);
  assert.equal(getLimits('candidate', 'pro_plus', 'tailor_profile').monthly, 200);
  assert.equal(getLimits('candidate', 'free', 'cover_letter').monthly, 2);
  assert.equal(getLimits('candidate', 'pro', 'cover_letter').monthly, 30);
  assert.equal(getLimits('candidate', 'pro_plus', 'cover_letter').monthly, 200);
});

test('plan: AI polish is 3 / 30 / unlimited after onboarding', () => {
  assert.equal(getLimits('candidate', 'free', 'profile_enhance').monthly, 3);
  assert.equal(getLimits('candidate', 'pro', 'profile_enhance').monthly, 30);
  assert.equal(getLimits('candidate', 'pro_plus', 'profile_enhance').monthly, -1);
});

test('plan: match score unlimited for all, autofill 5 free and unlimited paid', () => {
  for (const tier of ['onboarding', 'free', 'pro', 'pro_plus']) {
    assert.equal(getLimits('candidate', tier, 'job_match').monthly, -1, tier);
  }
  assert.equal(getLimits('candidate', 'free', 'autofill_apply').monthly, 5);
  assert.equal(getLimits('candidate', 'pro', 'autofill_apply').monthly, -1);
  assert.equal(getLimits('candidate', 'pro_plus', 'autofill_apply').monthly, -1);
});

test('plan: every candidate tier defines every candidate feature', () => {
  // A missing key resolves to { weekly: 0, monthly: 0 } = "not on your plan".
  const keys = new Set(Object.values(AI_LIMITS.candidate).flatMap((t) => Object.keys(t)));
  for (const [tier, limits] of Object.entries(AI_LIMITS.candidate)) {
    for (const key of keys) assert.ok(limits[key], `${tier} is missing ${key}`);
  }
});

// ── freeWhen: 'noProfileYet' ────────────────────────────────────────────────

test('freeWhen: free user with no profile is never capped by the monthly limit', async () => {
  users.u1 = { id: 'u1', role: 'candidate', subscriptionTier: 'free', aiOnboardingCompleted: false };
  for (let i = 0; i < 10; i++) usage.push({ userId: 'u1', featureType: 'profile_enhance', usedAt: new Date() });
  const out = await run(aiRateLimiter('profile_enhance', { freeWhen: 'noProfileYet' }), 'u1');
  assert.equal(out.passed, true);
  assert.equal(out.req.aiUsage.onboardingFree, true);
});

test('freeWhen: without the option the same user is capped', async () => {
  users.u1 = { id: 'u1', role: 'candidate', subscriptionTier: 'free', aiOnboardingCompleted: false };
  for (let i = 0; i < 10; i++) usage.push({ userId: 'u1', featureType: 'profile_enhance', usedAt: new Date() });
  const out = await run(aiRateLimiter('profile_enhance'), 'u1');
  assert.equal(out.passed, false);
  assert.equal(out.status, 429);
});

test('freeWhen: the abuse ceiling still applies with no profile', async () => {
  users.u1 = { id: 'u1', role: 'candidate', subscriptionTier: 'free', aiOnboardingCompleted: false };
  for (let i = 0; i < 40; i++) usage.push({ userId: 'u1', featureType: 'profile_enhance', usedAt: new Date() });
  const out = await run(aiRateLimiter('profile_enhance', { freeWhen: 'noProfileYet' }), 'u1');
  assert.equal(out.passed, false);
  assert.equal(out.status, 429);
});

test('freeWhen: onboarding usage does not eat the month once the profile is saved', async () => {
  users.u1 = { id: 'u1', role: 'candidate', subscriptionTier: 'free', aiOnboardingCompleted: true };
  const savedAt = new Date(Date.now() - 60 * 1000);
  profiles.u1 = { createdAt: savedAt };
  // Five polishes while building (before the save), two after.
  for (let i = 0; i < 5; i++) usage.push({ userId: 'u1', featureType: 'profile_enhance', usedAt: new Date(savedAt - 1000) });
  for (let i = 0; i < 2; i++) usage.push({ userId: 'u1', featureType: 'profile_enhance', usedAt: new Date() });

  const mw = aiRateLimiter('profile_enhance', { freeWhen: 'noProfileYet' });
  const third = await run(mw, 'u1');
  assert.equal(third.passed, true, 'third post-save polish is within 3/month');

  usage.push({ userId: 'u1', featureType: 'profile_enhance', usedAt: new Date() });
  const fourth = await run(mw, 'u1');
  assert.equal(fourth.passed, false);
  assert.equal(fourth.status, 429);
});

test('freeWhen: unknown values are a programming error', () => {
  assert.throws(() => aiRateLimiter('resume_parse', { freeWhen: 'sometimes' }));
});

// ── Lifetime trial and paid users in onboarding ─────────────────────────────

test('free tailoring stops after 3 lifetime', async () => {
  users.u1 = { id: 'u1', role: 'candidate', subscriptionTier: 'free', aiOnboardingCompleted: true };
  for (let i = 0; i < 3; i++) usage.push({ userId: 'u1', featureType: 'tailor_profile', usedAt: daysAgo(40 * i) });
  const out = await run(aiRateLimiter('tailor_profile'), 'u1');
  assert.equal(out.passed, false);
  assert.equal(out.status, 429);
});

test('a paid user who has not finished onboarding keeps their plan limits', async () => {
  users.u1 = { id: 'u1', role: 'candidate', subscriptionTier: 'pro', aiOnboardingCompleted: false };
  // Onboarding allows 1 lifetime tailoring; Pro allows 50 a month.
  for (let i = 0; i < 3; i++) usage.push({ userId: 'u1', featureType: 'tailor_profile', usedAt: new Date() });
  const out = await run(aiRateLimiter('tailor_profile'), 'u1');
  assert.equal(out.passed, true);
});

// ── Voice coach allowance ───────────────────────────────────────────────────

test('voice: free gets one 10 minute session, then none', async () => {
  const user = { id: 'u1', role: 'candidate', subscriptionTier: 'free', aiOnboardingCompleted: true };
  const first = await getVoiceAllowance(user);
  assert.equal(first.allowed, true);
  assert.equal(first.maxSessionMinutes, 10);

  usage.push({ userId: 'u1', featureType: 'coach_voice_session', usedAt: new Date(), metadata: { minutes: 10 } });
  const second = await getVoiceAllowance(user);
  assert.equal(second.allowed, false);
  assert.equal(second.reason, 'lifetime_used');
});

test('voice: Pro is metered in minutes and the last session is shortened', async () => {
  const user = { id: 'u1', role: 'candidate', subscriptionTier: 'pro', aiOnboardingCompleted: true };
  usage.push({ userId: 'u1', featureType: 'coach_voice_session', usedAt: new Date(), metadata: { minutes: 50 } });
  const out = await getVoiceAllowance(user);
  assert.equal(out.allowed, true);
  assert.equal(out.remainingMinutes, 10);
  assert.equal(out.maxSessionMinutes, 10);

  usage.push({ userId: 'u1', featureType: 'coach_voice_session', usedAt: new Date(), metadata: { minutes: 10 } });
  const spent = await getVoiceAllowance(user);
  assert.equal(spent.allowed, false);
  assert.equal(spent.reason, 'minutes_used');
});
