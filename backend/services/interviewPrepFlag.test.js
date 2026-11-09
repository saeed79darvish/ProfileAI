const test = require('node:test');
const assert = require('node:assert/strict');

function loadWith(env) {
  const saved = { a: process.env.ENABLE_INTERVIEW_PREP_STANDALONE, b: process.env.INTERVIEW_PREP_ALLOWED_USERS };
  if (env.flag === undefined) delete process.env.ENABLE_INTERVIEW_PREP_STANDALONE; else process.env.ENABLE_INTERVIEW_PREP_STANDALONE = env.flag;
  if (env.allow === undefined) delete process.env.INTERVIEW_PREP_ALLOWED_USERS; else process.env.INTERVIEW_PREP_ALLOWED_USERS = env.allow;
  delete require.cache[require.resolve('../config/featureFlags')];
  const flags = require('../config/featureFlags');
  if (saved.a === undefined) delete process.env.ENABLE_INTERVIEW_PREP_STANDALONE; else process.env.ENABLE_INTERVIEW_PREP_STANDALONE = saved.a;
  if (saved.b === undefined) delete process.env.INTERVIEW_PREP_ALLOWED_USERS; else process.env.INTERVIEW_PREP_ALLOWED_USERS = saved.b;
  return flags;
}

test('standalone interview prep is off by default: only admins get in', () => {
  const f = loadWith({});
  assert.equal(f.interviewPrepStandalone, false);
  assert.equal(f.userCanAccessInterviewPrepStandalone({ role: 'admin', email: 'a@x.com' }), true);
  assert.equal(f.userCanAccessInterviewPrepStandalone({ role: 'candidate', email: 'c@x.com' }), false);
  assert.equal(f.userCanAccessInterviewPrepStandalone({ role: 'recruiter', email: 'r@x.com' }), false);
  assert.equal(f.userCanAccessInterviewPrepStandalone(null), false);
});

test('an allowlisted candidate gets in, and the global flag opens it to every candidate', () => {
  const allow = loadWith({ allow: ' Tester@X.com, other@y.com ' });
  assert.equal(allow.userCanAccessInterviewPrepStandalone({ role: 'candidate', email: 'tester@x.com' }), true);
  assert.equal(allow.userCanAccessInterviewPrepStandalone({ role: 'candidate', email: 'nobody@x.com' }), false);
  const on = loadWith({ flag: 'true' });
  assert.equal(on.userCanAccessInterviewPrepStandalone({ role: 'candidate', email: 'nobody@x.com' }), true);
  assert.equal(on.userCanAccessInterviewPrepStandalone({ role: 'recruiter', email: 'r@x.com' }), false);
});
