/**
 * Smoke test for the Jobs feature (Week 1-5 endpoints).
 *
 * Exercises every endpoint we built or changed:
 *   - GET  /external-jobs               (list + various filter combos)
 *   - GET  /external-jobs/recommended   (rail)
 *   - GET  /external-jobs/skills        (typeahead corpus)
 *   - GET  /external-jobs/companies     (cached aggregation)
 *   - GET  /external-jobs/departments   (cached aggregation)
 *   - GET  /external-jobs/locations     (cached aggregation)
 *   - GET  /external-jobs/stats         (corpus probe)
 *   - GET  /external-jobs/saved         (polymorphic SavedJob list)
 *   - POST /external-jobs/check-saved   (polymorphic SavedJob batch check)
 *   - POST /external-jobs/:id/save      (round-trip)
 *   - DELETE /external-jobs/:id/save    (round-trip)
 *   - GET  /external-jobs/:id           (detail)
 *   - GET  /external-jobs/health        (admin only — soft-skip if not admin)
 *
 * Reports pass/fail per check with timing. Exits non-zero on any failure.
 *
 * Usage:
 *   API_URL=http://localhost:5000/api JWT=<token> node scripts/smokeTestJobs.js
 *
 * Generate a JWT for an existing user via your normal login flow, OR (faster)
 * sign one inline if you know JWT_SECRET:
 *
 *   node -e "console.log(require('jsonwebtoken').sign({id: 'YOUR_USER_UUID'}, process.env.JWT_SECRET, {expiresIn: '1h'}))"
 *
 * Add `--verbose` to see the raw response body of each check.
 */

require('dotenv').config();

const API_URL = (process.env.API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const JWT = process.env.JWT;
const VERBOSE = process.argv.includes('--verbose');

if (!JWT) {
  console.error('❌ JWT env var is required. Generate one and pass it:');
  console.error('   node -e "console.log(require(\'jsonwebtoken\').sign({id: \'<userId>\'}, process.env.JWT_SECRET, {expiresIn: \'1h\'}))"');
  process.exit(2);
}

const RESULTS = []; // { name, ok, ms, status, msg }

function ms(start) { return ((Date.now() - start)).toFixed(0); }

async function call(method, path, { body = null, expectStatus = 200 } = {}) {
  const url = `${API_URL}${path}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${JWT}`,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(20000),
  };
  if (body != null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { res, json, status: res.status };
}

async function check(name, fn) {
  const start = Date.now();
  try {
    const out = await fn();
    const took = ms(start);
    RESULTS.push({ name, ok: true, ms: took, status: out?.status || '', msg: out?.msg || '' });
    console.log(`  ✓ ${name.padEnd(48)} ${took}ms ${out?.msg || ''}`);
    return out;
  } catch (err) {
    const took = ms(start);
    RESULTS.push({ name, ok: false, ms: took, msg: err.message });
    console.log(`  ✗ ${name.padEnd(48)} ${took}ms  →  ${err.message}`);
    return null;
  }
}

function expect(cond, msg) { if (!cond) throw new Error(msg); }

async function main() {
  console.log(`\n🔬 Jobs smoke test  →  ${API_URL}\n`);

  // ── Probes ─────────────────────────────────────────────────────────────
  await check('GET /external-jobs/stats', async () => {
    const { json, status } = await call('GET', '/external-jobs/stats');
    expect(status === 200, `unexpected ${status}`);
    expect(typeof json.totalJobs === 'number', 'totalJobs missing');
    return { msg: `totalJobs=${json.totalJobs.toLocaleString()}` };
  });

  await check('GET /external-jobs/companies (cache miss + hit)', async () => {
    const a = await call('GET', '/external-jobs/companies');
    expect(a.status === 200, `unexpected ${a.status}`);
    expect(Array.isArray(a.json.companies), 'companies missing');
    const b = await call('GET', '/external-jobs/companies');
    expect(b.status === 200, `unexpected ${b.status} on second call`);
    return { msg: `${a.json.companies.length} companies` };
  });

  await check('GET /external-jobs/departments', async () => {
    const { json, status } = await call('GET', '/external-jobs/departments');
    expect(status === 200, `unexpected ${status}`);
    expect(Array.isArray(json.departments), 'departments missing');
    return { msg: `${json.departments.length} departments` };
  });

  await check('GET /external-jobs/locations', async () => {
    const { json, status } = await call('GET', '/external-jobs/locations');
    expect(status === 200, `unexpected ${status}`);
    expect(Array.isArray(json.locations), 'locations missing');
    return { msg: `${json.locations.length} locations` };
  });

  await check('GET /external-jobs/skills (typeahead corpus)', async () => {
    const { json, status } = await call('GET', '/external-jobs/skills?limit=20');
    expect(status === 200, `unexpected ${status}`);
    expect(Array.isArray(json.skills), 'skills missing');
    return { msg: `top skill: ${json.skills[0]?.skill || '(none)'}` };
  });

  // ── List endpoint — multiple filter combos ─────────────────────────────
  let firstJob = null;

  await check('GET /external-jobs (default sort)', async () => {
    const { json, status, res } = await call('GET', '/external-jobs?limit=5');
    expect(status === 200, `unexpected ${status}`);
    expect(Array.isArray(json.jobs), 'jobs missing');
    expect(json.pagination, 'pagination missing');
    firstJob = json.jobs[0] || null;
    const cacheHdr = res.headers.get('x-cache') || '';
    return { msg: `${json.jobs.length}/${json.pagination.total} • ${json.sortMethod || 'recent'} • X-Cache=${cacheHdr}` };
  });

  await check('GET /external-jobs (cache HIT on repeat)', async () => {
    const { res } = await call('GET', '/external-jobs?limit=5');
    const cacheHdr = res.headers.get('x-cache') || '';
    expect(cacheHdr === 'HIT', `expected X-Cache=HIT, got "${cacheHdr}"`);
    return { msg: `X-Cache=${cacheHdr}` };
  });

  await check('GET /external-jobs?sort=recent', async () => {
    const { json, status } = await call('GET', '/external-jobs?sort=recent&limit=5');
    expect(status === 200, `unexpected ${status}`);
    expect(Array.isArray(json.jobs), 'jobs missing');
    return { msg: `${json.jobs.length} jobs` };
  });

  await check('GET /external-jobs?datePosted=week', async () => {
    const { json, status } = await call('GET', '/external-jobs?datePosted=week&sort=recent&limit=5');
    expect(status === 200, `unexpected ${status}`);
    expect(Array.isArray(json.jobs), 'jobs missing');
    return { msg: `${json.jobs.length}/${json.pagination.total} in last week` };
  });

  await check('GET /external-jobs?search=engineer (ts_rank path)', async () => {
    const { json, status } = await call('GET', '/external-jobs?sort=recent&search=engineer&limit=5');
    expect(status === 200, `unexpected ${status}`);
    expect(Array.isArray(json.jobs), 'jobs missing');
    return { msg: `${json.jobs.length}/${json.pagination.total} matching "engineer"` };
  });

  await check('GET /external-jobs?skills=react (skill filter)', async () => {
    const { json, status } = await call('GET', '/external-jobs?skills=react&sort=recent&limit=5');
    expect(status === 200, `unexpected ${status}`);
    expect(Array.isArray(json.jobs), 'jobs missing');
    return { msg: `${json.jobs.length}/${json.pagination.total} match react` };
  });

  // ── Recommended rail ───────────────────────────────────────────────────
  await check('GET /external-jobs/recommended', async () => {
    const { json, status } = await call('GET', '/external-jobs/recommended?limit=4');
    expect(status === 200, `unexpected ${status}`);
    expect(Array.isArray(json.jobs), 'jobs missing');
    if (json.jobs.length > 0) {
      expect(typeof json.jobs[0]._recommendationReason === 'string', '_recommendationReason missing');
    }
    return { msg: `${json.jobs.length} recommendations` };
  });

  // ── Detail ─────────────────────────────────────────────────────────────
  if (firstJob) {
    await check(`GET /external-jobs/:id (sample)`, async () => {
      const { json, status } = await call('GET', `/external-jobs/${firstJob.id}`);
      expect(status === 200, `unexpected ${status}`);
      expect(json.id === firstJob.id, 'id mismatch');
      return { msg: firstJob.title.slice(0, 40) };
    });
  } else {
    console.log(`  ↷ Skipping detail / save round-trip — corpus appears empty.`);
  }

  // ── SavedJob round-trip ────────────────────────────────────────────────
  if (firstJob) {
    await check('POST /external-jobs/:id/save', async () => {
      const { status, json } = await call('POST', `/external-jobs/${firstJob.id}/save`);
      expect(status === 200, `unexpected ${status}: ${JSON.stringify(json)}`);
      return { msg: 'saved' };
    });

    await check('POST /external-jobs/check-saved (includes new save)', async () => {
      const { status, json } = await call('POST', '/external-jobs/check-saved', {
        body: { externalJobIds: [firstJob.id] }
      });
      expect(status === 200, `unexpected ${status}`);
      expect(Array.isArray(json.savedExternalJobIds), 'savedExternalJobIds missing');
      expect(json.savedExternalJobIds.includes(firstJob.id), 'just-saved id missing from check-saved response');
      return { msg: '1 id confirmed' };
    });

    await check('GET /external-jobs/saved', async () => {
      const { status, json } = await call('GET', '/external-jobs/saved');
      expect(status === 200, `unexpected ${status}`);
      expect(Array.isArray(json.savedJobs), 'savedJobs missing');
      const found = json.savedJobs.some(j => j.id === firstJob.id);
      expect(found, 'just-saved job missing from /saved');
      return { msg: `${json.savedJobs.length} total saved` };
    });

    await check('DELETE /external-jobs/:id/save', async () => {
      const { status } = await call('DELETE', `/external-jobs/${firstJob.id}/save`);
      expect(status === 200, `unexpected ${status}`);
      return { msg: 'unsaved' };
    });
  }

  // ── Health (admin only) ────────────────────────────────────────────────
  await check('GET /external-jobs/health (admin gate)', async () => {
    const { json, status } = await call('GET', '/external-jobs/health');
    if (status === 403) return { msg: 'soft-skip (caller not admin)' };
    expect(status === 200, `unexpected ${status}`);
    expect(typeof json.corpus?.totalActive === 'number', 'corpus.totalActive missing');
    expect(typeof json.counters?.listRequests === 'number', 'counters.listRequests missing');
    return {
      msg: `corpus=${json.corpus.totalActive.toLocaleString()} • boards=${json.boards.active}/${json.boards.total} • cache hit rate=${json.counters.listCacheHitRatePct}%`
    };
  });

  // ── Summary ────────────────────────────────────────────────────────────
  const passed = RESULTS.filter(r => r.ok).length;
  const failed = RESULTS.filter(r => !r.ok).length;
  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed (of ${RESULTS.length})\n`);

  if (VERBOSE) {
    console.log('--- detailed timings ---');
    RESULTS.forEach(r => console.log(`  ${r.ok ? '✓' : '✗'} ${r.name.padEnd(50)} ${r.ms}ms ${r.msg}`));
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('\n❌ Smoke test crashed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(2);
});
