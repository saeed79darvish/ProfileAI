#!/usr/bin/env node
/**
 * Smoke test — exercises the candidate launch surface end-to-end.
 *
 * Usage:
 *   API=http://localhost:5001 node scripts/smokeTest.js
 *   API=https://api.your-domain.com node scripts/smokeTest.js
 *
 * Exits 0 on full pass, 1 on any failure. Safe to wire into CI.
 * Does NOT touch recruiter routes (gated for candidate-only launch).
 */

const API = process.env.API || 'http://localhost:5001';
const ts = Date.now();
const TEST_USER = {
  firstName: 'Smoke',
  lastName: 'Test',
  email: `smoke+${ts}@profileai.test`,
  password: 'SmokeTest!2024xyz',
  role: 'candidate',
};

let pass = 0;
let fail = 0;
const failures = [];

async function step(name, fn) {
  process.stdout.write(`  → ${name} ... `);
  try {
    await fn();
    pass++;
    console.log('OK');
  } catch (err) {
    fail++;
    failures.push({ name, err: err.message });
    console.log('FAIL');
    console.log(`      ${err.message}`);
  }
}

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  console.log(`\nProfilleAI smoke test against ${API}`);
  console.log('─────────────────────────────────────────────────');

  let token;

  await step('health endpoint reachable', async () => {
    const r = await req('GET', '/health');
    assert(r.status === 200, `expected 200, got ${r.status}`);
  });

  await step('candidate registration', async () => {
    const r = await req('POST', '/api/auth/register', { body: TEST_USER });
    assert(r.status === 200 || r.status === 201, `expected 200/201, got ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
    assert(r.data?.token, 'no token in registration response');
    token = r.data.token;
  });

  await step('recruiter registration is blocked (flag off)', async () => {
    const r = await req('POST', '/api/auth/register', {
      body: { ...TEST_USER, email: `rec+${ts}@profileai.test`, role: 'recruiter' },
    });
    assert(r.status === 403, `expected 403, got ${r.status}`);
  });

  await step('login with correct credentials', async () => {
    const r = await req('POST', '/api/auth/login', {
      body: { email: TEST_USER.email, password: TEST_USER.password },
    });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.data?.token, 'no token in login response');
    token = r.data.token;
  });

  await step('login with wrong password returns 401', async () => {
    const r = await req('POST', '/api/auth/login', {
      body: { email: TEST_USER.email, password: 'wrong-password-xyz' },
    });
    assert(r.status === 401, `expected 401, got ${r.status}`);
  });

  await step('login with unknown email returns 401 (enum-safe)', async () => {
    const r = await req('POST', '/api/auth/login', {
      body: { email: `nobody+${ts}@profileai.test`, password: 'anything' },
    });
    assert(r.status === 401, `expected 401, got ${r.status}`);
  });

  await step('GET /api/auth/me returns user', async () => {
    const r = await req('GET', '/api/auth/me', { token });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.data?.email === TEST_USER.email, 'wrong user returned');
  });

  await step('unauthenticated profile request is rejected', async () => {
    const r = await req('GET', '/api/profiles/me');
    assert(r.status === 401, `expected 401, got ${r.status}`);
  });

  await step('recruiter surface returns 404 (flag off)', async () => {
    const r = await req('GET', '/api/smart-match/health', { token });
    // Either 404 (router not mounted) or 404 from requireRecruiterSurface
    assert(r.status === 404, `expected 404, got ${r.status}`);
  });

  await step('public jobs feed responds', async () => {
    const r = await req('GET', '/api/jobs?limit=1');
    assert(r.status === 200, `expected 200, got ${r.status}`);
  });

  await step('security headers present', async () => {
    const res = await fetch(`${API}/health`);
    const csp = res.headers.get('content-security-policy');
    const xfo = res.headers.get('x-frame-options');
    assert(csp, 'missing Content-Security-Policy header');
    assert(xfo === 'DENY', `expected X-Frame-Options DENY, got ${xfo}`);
  });

  console.log('─────────────────────────────────────────────────');
  console.log(`Passed: ${pass}   Failed: ${fail}\n`);
  if (fail > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  • ${f.name}: ${f.err}`);
    process.exit(1);
  }
  console.log('All checks passed.\n');
  process.exit(0);
})().catch((err) => {
  console.error('\nFatal smoke-test error:', err);
  process.exit(2);
});
