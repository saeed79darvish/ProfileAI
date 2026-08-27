#!/usr/bin/env node
/**
 * Dependency-free load generator for the ProfilleAI API.
 *
 * Answers one question: at N concurrent users, does the API still respond,
 * and if not, which layer gave out first?
 *
 * Usage:
 *   # 50 concurrent anonymous browsers against a local server for 60s
 *   TARGET=http://localhost:5001 VUS=50 DURATION=60 node scripts/loadTest.js
 *
 *   # 1000 concurrent signed-in users (needs seedLoadTestUsers.js first)
 *   VUS=1000 SCENARIO=authed TOKENS=/tmp/loadtest-tokens.json node scripts/loadTest.js
 *
 * Env:
 *   TARGET     base URL                         (default http://localhost:5001)
 *   VUS        concurrent virtual users         (default 50)
 *   DURATION   hold time in seconds             (default 60)
 *   RAMP       seconds to ramp up to VUS        (default 15)
 *   THINK      ms a VU pauses between steps     (default 700)
 *   SCENARIO   browse | authed | login | mixed  (default browse)
 *   TOKENS     path to JSON array of JWTs       (required for authed/mixed)
 *   TIMEOUT    per-request timeout ms           (default 30000)
 *   BYPASS     value for x-loadtest-token, to skip the IP rate limiter
 *   MAX_P95    fail the run if p95 exceeds this (ms, default 0 = no gate)
 *   MAX_ERROR  fail the run if error rate above this (%, default 0 = no gate)
 *   ABORT_ERROR_PCT  stop the run early if the last 10s exceed this error %
 *   ABORT_P95        stop the run early if the last 10s p95 exceeds this (ms)
 *   ALLOW_AI_SPEND=1 include endpoints that call a paid AI provider
 *
 * COST: endpoints marked `ai: true` below spend real money per request —
 * GET /external-jobs/recommended blocks on an OpenAI embedding whenever the
 * caller's profile embedding is missing or over 24h old. They are SKIPPED by
 * default, and refused outright against a non-local target.
 *
 * Safety: refuses to run against a non-localhost TARGET unless
 * CONFIRM_TARGET is set to that exact hostname. Only ever issues GETs
 * plus (in the `login` scenario) POST /api/auth/login — never writes data.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');

const TARGET = (process.env.TARGET || 'http://localhost:5001').replace(/\/$/, '');
const VUS = parseInt(process.env.VUS || '50', 10);
const DURATION = parseInt(process.env.DURATION || '60', 10);
const RAMP = parseInt(process.env.RAMP || '15', 10);
const THINK = parseInt(process.env.THINK || '700', 10);
const SCENARIO = process.env.SCENARIO || 'browse';
const TIMEOUT = parseInt(process.env.TIMEOUT || '30000', 10);
const BYPASS = process.env.BYPASS || '';
const MAX_P95 = parseInt(process.env.MAX_P95 || '0', 10);
const MAX_ERROR = parseFloat(process.env.MAX_ERROR || '0');
const ABORT_ERROR_PCT = parseFloat(process.env.ABORT_ERROR_PCT || '0');
const ABORT_P95 = parseInt(process.env.ABORT_P95 || '0', 10);
const ALLOW_AI_SPEND = process.env.ALLOW_AI_SPEND === '1';

const targetUrl = new URL(TARGET);
const isLocal = ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(targetUrl.hostname);

if (!isLocal && process.env.CONFIRM_TARGET !== targetUrl.hostname) {
  console.error(
    `\nRefusing to load-test ${targetUrl.hostname} without confirmation.\n` +
    `This will put real traffic on a real service.\n\n` +
    `  CONFIRM_TARGET=${targetUrl.hostname} TARGET=${TARGET} ... node scripts/loadTest.js\n`
  );
  process.exit(2);
}

// Against anything that isn't localhost, the run is locked to read-only,
// anonymous, AI-free traffic. Signed-in scenarios need seeded accounts (which
// this repo only creates locally) and the AI-backed endpoints cost money per
// request, so neither belongs in a test aimed at a live service.
const AI_SPEND_ALLOWED = ALLOW_AI_SPEND && isLocal;
if (!isLocal) {
  if (SCENARIO !== 'browse') {
    console.error(
      `\nSCENARIO=${SCENARIO} is local-only. Against a remote target only ` +
      `SCENARIO=browse (anonymous, read-only, no paid AI calls) is allowed.\n`
    );
    process.exit(2);
  }
  if (ALLOW_AI_SPEND) {
    console.error('\nALLOW_AI_SPEND is refused against a remote target.\n');
    process.exit(2);
  }
}

// ── HTTP plumbing ──────────────────────────────────────────────────────────
// One keep-alive agent shared by every VU. maxSockets must be >= VUS or the
// agent itself becomes the bottleneck and we'd measure our own queue instead
// of the server's.
const lib = targetUrl.protocol === 'https:' ? https : http;
const agent = new lib.Agent({
  keepAlive: true,
  maxSockets: VUS + 16,
  maxFreeSockets: VUS + 16,
  timeout: TIMEOUT,
});

function request(path, { method = 'GET', token = null, body = null } = {}) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      resolve({ ms: Number(process.hrtime.bigint() - started) / 1e6, ...result });
    };

    const headers = { 'accept-encoding': 'gzip', connection: 'keep-alive' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (BYPASS) headers['x-loadtest-token'] = BYPASS;
    if (body) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(body);
    }

    const req = lib.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path,
        method,
        headers,
        agent,
      },
      (res) => {
        let bytes = 0;
        // Drain the body — an undrained response holds its socket open and
        // the next VU iteration would silently queue behind it.
        res.on('data', (c) => { bytes += c.length; });
        res.on('end', () => done({ status: res.statusCode, bytes, headers: res.headers }));
        res.on('error', (err) => done({ status: 0, error: err.message }));
      }
    );

    req.setTimeout(TIMEOUT, () => req.destroy(new Error(`timeout after ${TIMEOUT}ms`)));
    req.on('error', (err) => done({ status: 0, error: err.message }));
    if (body) req.write(body);
    req.end();
  });
}

// ── Metrics ────────────────────────────────────────────────────────────────
const metrics = new Map(); // label -> { ms: [], statuses: Map, errors: Map, bytes }

// Rolling window of the last 10s of results, used by the abort watchdog. Kept
// separate from `metrics` because that one is cumulative — by the time a
// cumulative p95 crosses a threshold the target has usually been failing for
// a while, which is exactly what an abort is supposed to prevent.
const recent = [];

function record(label, res) {
  if (label !== 'probe:/health') {
    recent.push({ t: Date.now(), ms: res.ms, ok: res.status >= 200 && res.status < 400 });
  }
  let m = metrics.get(label);
  if (!m) {
    m = { ms: [], statuses: new Map(), errors: new Map(), bytes: 0, cacheHits: 0, cacheMiss: 0 };
    metrics.set(label, m);
  }
  m.ms.push(res.ms);
  m.bytes += res.bytes || 0;
  m.statuses.set(res.status, (m.statuses.get(res.status) || 0) + 1);
  if (res.error) m.errors.set(res.error, (m.errors.get(res.error) || 0) + 1);
  const xc = res.headers && res.headers['x-cache'];
  if (xc === 'HIT') m.cacheHits++;
  else if (xc === 'MISS') m.cacheMiss++;
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

// ── Scenarios ──────────────────────────────────────────────────────────────
// Each step is [label, pathFn]. A VU walks the list in order, pausing THINK
// ms between steps, then starts over — roughly what one person browsing the
// job surface actually generates.
const SEARCHES = ['engineer', 'react', 'product manager', 'data', 'remote', 'senior'];
const LOCATIONS = ['Remote', 'New York', 'London', 'San Francisco'];

let jobIds = [];

const pick = (arr, i) => arr[i % arr.length];

// Each step is [label, pathFn, spendsOnAI]. Anonymous browsing is entirely
// AI-free: the feed's semantic branch requires a signed-in profile, and the
// query-embedding call was deliberately removed from the request path (see the
// comment block in routes/externalJobs.js), so ranking happens inside Postgres.
const BROWSE_STEPS = [
  ['feed:page1', (i) => `/api/external-jobs?page=1&limit=20&sortBy=recent`],
  ['facets:companies', () => `/api/external-jobs/companies`],
  ['facets:locations', () => `/api/external-jobs/locations`],
  ['feed:search', (i) => `/api/external-jobs?page=1&limit=20&search=${encodeURIComponent(pick(SEARCHES, i))}`],
  ['job:detail', (i) => (jobIds.length ? `/api/external-jobs/${pick(jobIds, i)}` : null)],
  ['feed:filtered', (i) => `/api/external-jobs?page=1&limit=20&location=${encodeURIComponent(pick(LOCATIONS, i))}`],
  ['feed:page2', () => `/api/external-jobs?page=2&limit=20&sortBy=recent`],
];

const AUTHED_STEPS = [
  ['me', () => `/api/profiles/me`],
  ['feed:page1', () => `/api/external-jobs?page=1&limit=20&sortBy=recent`],
  // PAID: blocks on an OpenAI embedding when the profile's vector is missing
  // or older than 24h. seedLoadTestUsers.js writes a fresh synthetic vector so
  // this stays free locally, but any real account without one costs a call.
  ['feed:recommended', () => `/api/external-jobs/recommended?limit=20`, true],
  ['saved', () => `/api/external-jobs/saved?page=1&limit=20`],
  ['notifications', () => `/api/notifications?limit=20`],
  ['job:detail', (i) => (jobIds.length ? `/api/external-jobs/${pick(jobIds, i)}` : null)],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let running = true;
let tokens = [];

async function virtualUser(id) {
  const authed =
    SCENARIO === 'authed' || (SCENARIO === 'mixed' && id % 2 === 0);
  const steps = (authed ? AUTHED_STEPS : BROWSE_STEPS).filter(
    ([, , spendsOnAI]) => !spendsOnAI || AI_SPEND_ALLOWED
  );
  const token = authed && tokens.length ? pick(tokens, id) : null;
  let i = id;

  while (running) {
    for (const [label, pathFn] of steps) {
      if (!running) return;
      const path = pathFn(i);
      if (!path) continue;
      const res = await request(path, { token });
      record(`${authed ? 'auth' : 'anon'} ${label}`, res);
      i++;
      if (THINK > 0) await sleep(THINK + Math.floor((i * 37) % 200));
    }
  }
}

// Login is its own scenario: it is by far the most expensive request the API
// serves (bcrypt cost 10 burns ~60-100ms of pure CPU per attempt, on the same
// single thread that serves every other request), so mixing it into a browse
// run would smear that cost across unrelated labels.
async function loginUser(id, creds) {
  while (running) {
    const c = pick(creds, id);
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: c.email, password: c.password }),
    });
    record('login', res);
    id++;
    await sleep(THINK);
  }
}

// A dedicated low-rate probe against /health. /health touches no database and
// does no work, so its latency is a near-pure read of event-loop lag: if this
// climbs while the DB looks fine, the bottleneck is CPU on the Node process,
// not Postgres.
async function healthProbe() {
  while (running) {
    record('probe:/health', await request('/health'));
    await sleep(500);
  }
}

let abortedBecause = null;

// Watchdog. Against a live service the point is to find where it starts to
// hurt, then stop — not to hold it under after it has already given out.
function watchdog() {
  if (!ABORT_ERROR_PCT && !ABORT_P95) return null;
  return setInterval(() => {
    const cutoff = Date.now() - 10_000;
    while (recent.length && recent[0].t < cutoff) recent.shift();
    if (recent.length < 30) return; // too small a sample to judge

    const errors = recent.filter((r) => !r.ok).length;
    const errPct = (errors / recent.length) * 100;
    const sorted = recent.map((r) => r.ms).sort((a, b) => a - b);
    const p95 = pct(sorted, 95);

    if (ABORT_ERROR_PCT && errPct > ABORT_ERROR_PCT) {
      abortedBecause = `error rate ${errPct.toFixed(1)}% over the last 10s exceeded ABORT_ERROR_PCT=${ABORT_ERROR_PCT}%`;
    } else if (ABORT_P95 && p95 > ABORT_P95) {
      abortedBecause = `p95 ${Math.round(p95)}ms over the last 10s exceeded ABORT_P95=${ABORT_P95}ms`;
    }
    if (abortedBecause) running = false;
  }, 1000);
}

// ── Report ─────────────────────────────────────────────────────────────────
function report(elapsedSec) {
  const rows = [];
  let totalReq = 0;
  let totalErr = 0;

  for (const [label, m] of [...metrics.entries()].sort()) {
    const sorted = [...m.ms].sort((a, b) => a - b);
    const n = sorted.length;
    rows.push({ label, n, sorted, m });
    totalReq += n;
  }

  console.log('');
  console.log('='.repeat(104));
  console.log(`RESULTS  target=${TARGET}  scenario=${SCENARIO}  vus=${VUS}  held=${DURATION}s  elapsed=${elapsedSec.toFixed(1)}s`);
  console.log('='.repeat(104));
  console.log(
    'endpoint'.padEnd(28) +
    'reqs'.padStart(8) +
    'rps'.padStart(8) +
    'p50'.padStart(9) +
    'p90'.padStart(9) +
    'p95'.padStart(9) +
    'p99'.padStart(9) +
    'max'.padStart(9) +
    '  ok%' +
    '   cache'
  );
  console.log('-'.repeat(104));

  let allMs = [];
  for (const { label, n, sorted, m } of rows) {
    const ok = [...m.statuses.entries()]
      .filter(([s]) => s >= 200 && s < 400)
      .reduce((a, [, c]) => a + c, 0);
    totalErr += n - ok;
    allMs = allMs.concat(sorted);
    const cacheTotal = m.cacheHits + m.cacheMiss;
    const cacheStr = cacheTotal
      ? `${Math.round((m.cacheHits / cacheTotal) * 100)}% hit`
      : '-';
    console.log(
      label.padEnd(28) +
      String(n).padStart(8) +
      (n / elapsedSec).toFixed(1).padStart(8) +
      Math.round(pct(sorted, 50)).toString().padStart(9) +
      Math.round(pct(sorted, 90)).toString().padStart(9) +
      Math.round(pct(sorted, 95)).toString().padStart(9) +
      Math.round(pct(sorted, 99)).toString().padStart(9) +
      Math.round(sorted[sorted.length - 1] || 0).toString().padStart(9) +
      `  ${((ok / n) * 100).toFixed(1)}%`.padStart(7) +
      `   ${cacheStr}`
    );
  }

  console.log('-'.repeat(104));
  allMs.sort((a, b) => a - b);
  const errRate = totalReq ? (totalErr / totalReq) * 100 : 0;
  console.log(
    `TOTAL: ${totalReq} requests, ${(totalReq / elapsedSec).toFixed(1)} rps, ` +
    `p50=${Math.round(pct(allMs, 50))}ms p95=${Math.round(pct(allMs, 95))}ms p99=${Math.round(pct(allMs, 99))}ms, ` +
    `errors=${totalErr} (${errRate.toFixed(2)}%)`
  );

  // Non-2xx breakdown — this is where the run explains itself. 429 means the
  // IP rate limiter fired (set BYPASS); 503/502 means the dyno fell over;
  // status 0 means the connection never completed at all.
  const statusTotals = new Map();
  const errorTotals = new Map();
  for (const [, m] of metrics) {
    for (const [s, c] of m.statuses) statusTotals.set(s, (statusTotals.get(s) || 0) + c);
    for (const [e, c] of m.errors) errorTotals.set(e, (errorTotals.get(e) || 0) + c);
  }
  const nonOk = [...statusTotals.entries()].filter(([s]) => s < 200 || s >= 400);
  if (nonOk.length) {
    console.log('\nnon-2xx/3xx responses:');
    for (const [s, c] of nonOk.sort((a, b) => b[1] - a[1])) {
      const meaning = {
        0: 'connection failed / timed out — server stopped accepting or answering',
        429: 'rate limited by express-rate-limit (set BYPASS to test past it)',
        502: 'bad gateway — the process died or never answered the proxy',
        503: 'service unavailable — platform shed the request',
        504: 'gateway timeout — request exceeded the platform timeout',
        500: 'unhandled server error — check logs/Sentry',
        401: 'unauthorized — token missing or expired',
      }[s] || '';
      console.log(`  ${String(s).padEnd(5)} ${String(c).padStart(7)}  ${meaning}`);
    }
  }
  if (errorTotals.size) {
    console.log('\nsocket-level errors:');
    for (const [e, c] of [...errorTotals.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(c).padStart(7)}  ${e}`);
    }
  }

  const health = metrics.get('probe:/health');
  if (health) {
    const hs = [...health.ms].sort((a, b) => a - b);
    console.log(
      `\nevent-loop probe (/health, no I/O): p50=${Math.round(pct(hs, 50))}ms ` +
      `p95=${Math.round(pct(hs, 95))}ms p99=${Math.round(pct(hs, 99))}ms max=${Math.round(hs[hs.length - 1])}ms`
    );
    if (pct(hs, 95) > 250) {
      console.log('  ^ /health should answer in single-digit ms. This high means the Node');
      console.log('    event loop is saturated — requests are queuing for CPU, not for the DB.');
    }
  }

  let exit = 0;
  if (abortedBecause) exit = 1;
  if (MAX_P95 && pct(allMs, 95) > MAX_P95) {
    console.log(`\nFAIL: p95 ${Math.round(pct(allMs, 95))}ms exceeds MAX_P95=${MAX_P95}ms`);
    exit = 1;
  }
  if (MAX_ERROR && errRate > MAX_ERROR) {
    console.log(`\nFAIL: error rate ${errRate.toFixed(2)}% exceeds MAX_ERROR=${MAX_ERROR}%`);
    exit = 1;
  }
  console.log('');
  return exit;
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  if (SCENARIO === 'authed' || SCENARIO === 'mixed') {
    if (!process.env.TOKENS) {
      console.error('SCENARIO=' + SCENARIO + ' needs TOKENS=<path to tokens json>. Run scripts/seedLoadTestUsers.js first.');
      process.exit(2);
    }
    tokens = JSON.parse(fs.readFileSync(process.env.TOKENS, 'utf8'));
    if (!Array.isArray(tokens) || !tokens.length) {
      console.error('TOKENS file is empty or not an array.');
      process.exit(2);
    }
    console.log(`Loaded ${tokens.length} tokens.`);
  }

  // Bootstrap: one warm-up request that both proves the target is reachable
  // and gives us real job ids for the detail-page step.
  process.stdout.write(`Probing ${TARGET} ... `);
  const boot = await request('/api/external-jobs?page=1&limit=20');
  if (boot.status !== 200) {
    console.error(`FAILED (status ${boot.status}${boot.error ? ': ' + boot.error : ''})`);
    process.exit(2);
  }
  console.log(`OK (${Math.round(boot.ms)}ms)`);

  // Re-fetch with the body kept so we can pull ids out of it.
  const idsRes = await new Promise((resolve) => {
    const req = lib.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path: '/api/external-jobs?page=1&limit=50',
        method: 'GET',
        headers: BYPASS ? { 'x-loadtest-token': BYPASS } : {},
        agent,
      },
      (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { buf += c; });
        res.on('end', () => resolve(buf));
      }
    );
    req.on('error', () => resolve(''));
    req.end();
  });
  try {
    const parsed = JSON.parse(idsRes);
    jobIds = (parsed.jobs || []).map((j) => j.id).filter(Boolean);
  } catch { /* detail step is skipped when we have no ids */ }
  console.log(`Got ${jobIds.length} job ids for detail-page steps.`);

  let creds = [];
  if (SCENARIO === 'login') {
    if (!process.env.CREDS) {
      console.error('SCENARIO=login needs CREDS=<path to creds json> (from seedLoadTestUsers.js).');
      process.exit(2);
    }
    creds = JSON.parse(fs.readFileSync(process.env.CREDS, 'utf8'));
  }

  console.log(
    `\nRamping to ${VUS} VUs over ${RAMP}s, holding ${DURATION}s ` +
    `(scenario=${SCENARIO}, think=${THINK}ms${BYPASS ? ', rate-limit bypass ON' : ''}).\n`
  );

  const startedAt = Date.now();
  const runners = [healthProbe()];
  const rampDelay = RAMP > 0 ? (RAMP * 1000) / VUS : 0;

  for (let i = 0; i < VUS; i++) {
    runners.push(
      (async () => {
        await sleep(Math.floor(i * rampDelay));
        if (!running) return;
        if (SCENARIO === 'login') return loginUser(i, creds);
        return virtualUser(i);
      })()
    );
    if (i > 0 && i % 100 === 0) await sleep(0); // yield so the loop stays responsive
  }

  // Progress ticker so a long run isn't a silent wait.
  const totalMs = (RAMP + DURATION) * 1000;
  const ticker = setInterval(() => {
    const el = (Date.now() - startedAt) / 1000;
    let n = 0;
    for (const [, m] of metrics) n += m.ms.length;
    process.stdout.write(`\r  ${el.toFixed(0)}s / ${RAMP + DURATION}s   ${n} requests   ${(n / el).toFixed(0)} rps   `);
  }, 1000);

  const watch = watchdog();

  // Poll rather than a flat sleep so the watchdog can end the run early.
  const endAt = Date.now() + totalMs;
  while (Date.now() < endAt && running) await sleep(250);

  running = false;
  clearInterval(ticker);
  if (watch) clearInterval(watch);
  process.stdout.write('\r' + ' '.repeat(70) + '\r');
  if (abortedBecause) {
    console.log(`ABORTED EARLY: ${abortedBecause}`);
    console.log('Load was removed at that point — the numbers below cover the run up to the abort.');
  }
  console.log('Draining in-flight requests...');
  await Promise.race([Promise.all(runners), sleep(TIMEOUT + 2000)]);
  agent.destroy();

  process.exit(report((Date.now() - startedAt) / 1000));
})();
