const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const path = require('path');

// Stub Stripe and the models before paymentService loads.
const calls = { customersCreate: 0, sessions: [], userUpdates: [], subUpdates: [] };
let stripeState = {};
const stripeStub = () => ({
  customers: {
    retrieve: async (id) => { if (stripeState.customerMissing) throw new Error('No such customer'); return { id }; },
    create: async () => { calls.customersCreate++; return { id: 'cus_live_new' }; },
  },
  subscriptions: { retrieve: async () => stripeState.sub || Promise.reject(new Error('No such subscription')) },
  checkout: { sessions: { create: async (o) => { calls.sessions.push(o); return { id: 'cs_1', url: 'https://x' }; } } },
  billingPortal: { sessions: { create: async (o) => ({ url: 'https://portal/' + o.customer }) } },
});
const user = { id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B', role: 'candidate', stripeCustomerId: 'cus_test_old', stripeSubscriptionId: null };
const modelsStub = {
  User: { findByPk: async () => user, update: async (v) => { calls.userUpdates.push(v); }, findOne: async () => user },
  Subscription: { PLANS: { candidate: { pro: { name: 'Pro', price: 20, yearlyPrice: 200, features: {} } }, recruiter: {} }, update: async (v) => { calls.subUpdates.push(v); } },
};
const origLoad = Module._load;
Module._load = function (req, parent, ...rest) {
  if (req === 'stripe') return stripeStub;
  if (req === '../models' && parent && parent.filename.endsWith(path.join('services', 'paymentService.js'))) return modelsStub;
  return origLoad.call(this, req, parent, ...rest);
};
const svc = require('./paymentService');
Module._load = origLoad;

test('a customer id from another Stripe mode is replaced, not reused', async () => {
  stripeState = { customerMissing: true };
  calls.customersCreate = 0; calls.sessions = [];
  await svc.createStripeCheckoutSession('u1', 'pro', 'monthly');
  assert.equal(calls.customersCreate, 1);
  assert.equal(calls.sessions[0].customer, 'cus_live_new');
});

test('a second checkout is refused while a subscription is active', async () => {
  stripeState = { sub: { status: 'active', cancel_at_period_end: false } };
  user.stripeSubscriptionId = 'sub_1';
  await assert.rejects(() => svc.createStripeCheckoutSession('u1', 'pro', 'monthly'), (e) => e.statusCode === 409);
});

test('a leftover test-mode subscription id does not block checkout', async () => {
  stripeState = {};
  user.stripeSubscriptionId = 'sub_test_old';
  const r = await svc.createStripeCheckoutSession('u1', 'pro', 'yearly');
  assert.equal(r.url, 'https://x');
});

test('a renewal moves the access-until date forward', async () => {
  calls.userUpdates = []; calls.subUpdates = [];
  await svc.handlePaymentSucceeded({ id: 'in_1', customer: 'cus_1', lines: { data: [{ period: { end: 1900000000 } }] } });
  assert.equal(calls.userUpdates[0].subscriptionExpiresAt.getTime(), 1900000000 * 1000);
  assert.equal(calls.userUpdates[0].subscriptionStatus, 'active');
});

test('billing portal needs an existing customer', async () => {
  const r = await svc.createBillingPortalSession('u1');
  assert.match(r.url, /portal/);
  user.stripeCustomerId = null;
  await assert.rejects(() => svc.createBillingPortalSession('u1'), (e) => e.statusCode === 404);
});
