/**
 * Coach tailor preview: validation, the SSRF guard, the mapping onto the
 * frontend contract, and that a guest run writes nothing.
 *
 * No model and no network is reached: the tailoring engine, the match read and
 * the page fetch are injected (service tests) or stubbed in the require cache
 * (route test).
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// ── Guard: any Sequelize write anywhere in this process fails the test ──────
const { Model } = require('sequelize');
const writes = [];
for (const m of ['create', 'bulkCreate', 'update', 'destroy', 'upsert', 'increment', 'findOrCreate']) {
  const orig = Model[m];
  Model[m] = function trapped(...args) {
    writes.push(`${this.name}.${m}`);
    return orig ? Promise.reject(new Error(`unexpected write ${this.name}.${m}`)) : undefined;
  };
}
for (const m of ['save', 'update', 'destroy', 'increment']) {
  Model.prototype[m] = function trapped() {
    writes.push(`instance.${m}`);
    return Promise.reject(new Error(`unexpected write instance.${m}`));
  };
}

const {
  createCoachTailorService,
  CoachTailorError,
  validateJobUrl,
  isPrivateIp,
  defaultFetchJobPosting,
  extractPostingFromHtml,
  URL_UNREADABLE_MESSAGE,
} = require('./coachTailorService');

// ── Fixtures ────────────────────────────────────────────────────────────────

const PROFILE = {
  title: 'Senior Software Engineer',
  location: 'Toronto, ON',
  summary: 'Backend engineer focused on payments.',
  skills: ['Go', 'Kubernetes', 'PostgreSQL'],
  experience: [
    { title: 'Senior Software Engineer', company: 'Acme', startDate: '2021-01', endDate: '', current: true, description: 'Built billing services in Go on Kubernetes.' },
    { title: 'Software Engineer', company: 'Initech', startDate: '2017-06', endDate: '2020-12', current: false, description: 'Backend services in Go.' },
  ],
  education: [{ institution: 'University of Waterloo', degree: 'BMath', fieldOfStudy: 'Computer Science', endDate: '2017' }],
  projects: [],
  linkedinUrl: '',
  githubUrl: '',
};

const JD = `We are hiring a Staff Backend Engineer to lead our payments platform.
Requirements: 6+ years building distributed backend systems, strong Go, Kubernetes in production,
experience with PostgreSQL at scale, and Terraform. Nice to have: Kafka. You will own the ledger
service end to end, mentor engineers, and work with product on roadmap.`;

const MATCH_READ = {
  jobTitle: 'Staff Backend Engineer',
  requirements: [
    { requirement: 'Strong Go', type: 'skill', hardness: 'must', coverage: 'strong', evidence: '[1]' },
    { requirement: 'Kubernetes in production', type: 'skill', hardness: 'must', coverage: 'strong', evidence: '[1]' },
    { requirement: 'PostgreSQL at scale', type: 'skill', hardness: 'must', coverage: 'partial', evidence: 'skills' },
    { requirement: 'Terraform', type: 'skill', hardness: 'must', coverage: 'none', evidence: '' },
    { requirement: 'Kafka', type: 'skill', hardness: 'nice', coverage: 'none', evidence: '' },
    { requirement: 'Own the ledger service', type: 'responsibility', hardness: 'must', coverage: 'strong', evidence: '' },
  ],
  roleFit: 1,
  seniorityFit: 0.8,
  recency: 1,
  verdict: 'Strong Go and Kubernetes match; Terraform is the main gap.',
};

const TAILORED = { title: 'Staff Backend Engineer', summary: 'Backend engineer...', skills: ['Go'], experience: [] };

function makeService(overrides = {}) {
  const calls = { tailor: [], generate: [], fetch: [] };
  const service = createCoachTailorService({
    tailorProfileForJob: async (...args) => {
      calls.tailor.push(args);
      return { success: true, data: TAILORED };
    },
    generateText: async (prompt, opts) => {
      calls.generate.push({ prompt, opts });
      return '```json\n' + JSON.stringify(MATCH_READ) + '\n```';
    },
    fetchJobPosting: async (url) => {
      calls.fetch.push(url);
      return { jobDescription: JD, jobTitle: 'Staff Backend Engineer', company: 'Globex' };
    },
    ...overrides,
  });
  return { service, calls };
}

async function rejectsWith(promise, status, code) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof CoachTailorError, `expected CoachTailorError, got ${err && err.message}`);
    assert.equal(err.status, status);
    assert.equal(err.code, code);
    return true;
  });
}

// ── Input validation ────────────────────────────────────────────────────────

describe('input validation', () => {
  test('missing job is a 400 and spends nothing', async () => {
    const { service, calls } = makeService();
    await rejectsWith(service.tailorPreview({ profile: PROFILE }), 400, 'job_required');
    assert.equal(calls.tailor.length + calls.generate.length + calls.fetch.length, 0);
  });

  test('too-short description is a 400', async () => {
    const { service, calls } = makeService();
    await rejectsWith(service.tailorPreview({ profile: PROFILE, jobDescription: 'Go engineer wanted.' }), 400, 'job_description_too_short');
    assert.equal(calls.tailor.length, 0);
  });

  test('empty profile is a 400', async () => {
    const { service } = makeService();
    await rejectsWith(service.tailorPreview({ profile: {}, jobDescription: JD }), 400, 'profile_required');
  });

  test('malformed and non-http URLs are rejected before any fetch', async () => {
    const { service, calls } = makeService();
    for (const bad of ['not a url', 'ftp://example.com/job', 'javascript:alert(1)', 'file:///etc/passwd', 'https://user:pw@example.com/job']) {
      await rejectsWith(service.tailorPreview({ profile: PROFILE, jobUrl: bad }), 400, 'invalid_job_url');
    }
    assert.equal(calls.fetch.length, 0);
  });

  test('private and internal addresses are rejected before any fetch', async () => {
    const { service, calls } = makeService();
    const privateUrls = [
      'http://localhost/job',
      'http://127.0.0.1/job',
      'http://127.1.2.3:8080/job',
      'http://10.0.0.5/job',
      'http://192.168.1.1/job',
      'http://172.16.4.4/job',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/job',
      'http://[fd00::1]/job',
      'http://[::ffff:127.0.0.1]/job',
      'http://0x7f000001/job',
      'http://2130706433/job',
      'http://metadata.internal/job',
      'http://intranet/job',
    ];
    for (const url of privateUrls) {
      await rejectsWith(service.tailorPreview({ profile: PROFILE, jobUrl: url }), 400, 'invalid_job_url');
    }
    assert.equal(calls.fetch.length, 0);
  });

  test('isPrivateIp distinguishes public from private', () => {
    assert.equal(isPrivateIp('8.8.8.8'), false);
    assert.equal(isPrivateIp('104.16.0.1'), false);
    assert.equal(isPrivateIp('2606:4700::1'), false);
    assert.equal(isPrivateIp('10.1.1.1'), true);
    assert.equal(isPrivateIp('fe80::1'), true);
    assert.equal(validateJobUrl('https://boards.greenhouse.io/acme/jobs/1').hostname, 'boards.greenhouse.io');
  });

  test('a public name that resolves to a private address is rejected', async () => {
    let fetched = false;
    await rejectsWith(
      defaultFetchJobPosting('https://evil.example.com/job', {
        resolveHost: async () => ['93.184.216.34', '127.0.0.1'],
        fetchImpl: async () => { fetched = true; return new Response('x'); },
      }),
      400,
      'invalid_job_url',
    );
    assert.equal(fetched, false);
  });

  test('a redirect onto a private address is not followed', async () => {
    const seen = [];
    await rejectsWith(
      defaultFetchJobPosting('https://jobs.example.com/1', {
        resolveHost: async () => ['93.184.216.34'],
        fetchImpl: async (url) => {
          seen.push(url);
          return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest' } });
        },
      }),
      422,
      'job_url_unreadable',
    );
    assert.deepEqual(seen, ['https://jobs.example.com/1']);
  });

  test('an unreadable page is a 422 with the paste-instead message', async () => {
    const { service } = makeService({ fetchJobPosting: async () => { throw new Error('ECONNRESET'); } });
    await assert.rejects(service.tailorPreview({ profile: PROFILE, jobUrl: 'https://www.linkedin.com/jobs/view/1' }), (err) => {
      assert.equal(err.status, 422);
      assert.equal(err.code, 'job_url_unreadable');
      assert.equal(err.message, URL_UNREADABLE_MESSAGE);
      return true;
    });

    const thin = makeService({ fetchJobPosting: async () => ({ jobDescription: 'Sign in to view this job', jobTitle: '' }) });
    await rejectsWith(thin.service.tailorPreview({ profile: PROFILE, jobUrl: 'https://www.linkedin.com/jobs/view/1' }), 422, 'job_url_unreadable');
  });
});

// ── Page extraction ─────────────────────────────────────────────────────────

describe('posting extraction', () => {
  test('reads schema.org JobPosting when the page has one', () => {
    const html = `<html><head><title>Careers</title>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: 'Staff Backend Engineer',
        hiringOrganization: { '@type': 'Organization', name: 'Globex' },
        description: `<p>${JD.replace(/\n/g, ' ')}</p><ul><li>Go</li><li>Kubernetes</li></ul>`,
      })}</script></head><body>nav junk</body></html>`;
    const out = extractPostingFromHtml(html);
    assert.equal(out.jobTitle, 'Staff Backend Engineer');
    assert.equal(out.company, 'Globex');
    assert.match(out.jobDescription, /Terraform/);
    assert.doesNotMatch(out.jobDescription, /<p>/);
  });

  test('falls back to page text', () => {
    const html = `<html><head><title>Staff Engineer - Globex</title><script>var x=1</script></head>
      <body><nav>Home About</nav><main><h1>Staff Engineer</h1><p>${JD}</p></main></body></html>`;
    const out = extractPostingFromHtml(html);
    assert.equal(out.jobTitle, 'Staff Engineer - Globex');
    assert.match(out.jobDescription, /Terraform/);
    assert.doesNotMatch(out.jobDescription, /var x=1|Home About/);
  });
});

// ── Output mapping ──────────────────────────────────────────────────────────

describe('output mapping', () => {
  test('pasted description maps onto { success, tailored, match, jobTitle, company }', async () => {
    const { service, calls } = makeService();
    const out = await service.tailorPreview({ profile: PROFILE, jobDescription: JD });

    assert.equal(out.success, true);
    assert.deepEqual(out.tailored, TAILORED);
    assert.equal(typeof out.match.score, 'number');
    assert.ok(out.match.score >= 0 && out.match.score <= 100);
    assert.equal(out.match.summary, MATCH_READ.verdict);
    assert.deepEqual(out.match.strengths, ['Strong Go', 'Kubernetes in production']);
    // Missing must-haves first, then partial, then nice-to-haves; responsibilities never.
    assert.deepEqual(out.match.gaps, ['Terraform', 'PostgreSQL at scale', 'Kafka']);
    assert.equal(out.jobTitle, 'Staff Backend Engineer'); // from the model's read
    assert.equal(out.company, '');

    // The real tailoring engine was given the draft, the JD and no resume text.
    const [profileData, jd, resumeText] = calls.tailor[0];
    assert.equal(profileData.title, PROFILE.title);
    assert.equal(profileData.experience.length, 2);
    assert.equal(jd, JD.trim());
    assert.equal(resumeText, null);

    // The job-match prompt saw education under the keys it reads.
    assert.match(calls.generate[0].prompt, /University of Waterloo/);
    assert.equal(calls.generate[0].opts.maxTokens, 4000);
  });

  test('job URL carries the posting title and company through', async () => {
    const { service, calls } = makeService();
    const out = await service.tailorPreview({ profile: PROFILE, jobUrl: 'https://boards.greenhouse.io/globex/jobs/123' });
    assert.equal(calls.fetch[0], 'https://boards.greenhouse.io/globex/jobs/123');
    assert.equal(out.jobTitle, 'Staff Backend Engineer');
    assert.equal(out.company, 'Globex');
    assert.deepEqual(calls.tailor[0][5], { jobTitle: 'Staff Backend Engineer', company: 'Globex' });
  });

  test('truncated match JSON is repaired rather than dropped', async () => {
    const full = JSON.stringify(MATCH_READ);
    const cut = full.slice(0, full.indexOf('"roleFit"') + 14); // mid-object
    const { service } = makeService({ generateText: async () => cut });
    const out = await service.tailorPreview({ profile: PROFILE, jobDescription: JD });
    assert.equal(typeof out.match.score, 'number');
    assert.ok(out.match.strengths.includes('Strong Go'));
  });

  test('an unreadable match keeps the tailored resume and returns an empty match', async () => {
    const { service } = makeService({ generateText: async () => 'Sorry, I cannot help with that.' });
    const out = await service.tailorPreview({ profile: PROFILE, jobDescription: JD });
    assert.deepEqual(out.tailored, TAILORED);
    assert.deepEqual(out.match, { score: null, summary: '', strengths: [], gaps: [] });
  });

  test('a failed tailoring run is a 502', async () => {
    const { service } = makeService({ tailorProfileForJob: async () => ({ success: false, error: 'boom' }) });
    await rejectsWith(service.tailorPreview({ profile: PROFILE, jobDescription: JD }), 502, 'tailor_failed');
  });

  test('profile input is bounded before it reaches a prompt', async () => {
    const { service, calls } = makeService();
    const huge = {
      ...PROFILE,
      summary: 'x'.repeat(50000),
      embedding: [1, 2, 3],
      experience: Array.from({ length: 40 }, () => PROFILE.experience[0]),
    };
    await service.tailorPreview({ profile: huge, jobDescription: JD });
    const [profileData] = calls.tailor[0];
    assert.equal(profileData.summary.length, 3000);
    assert.equal(profileData.experience.length, 15);
    assert.equal(profileData.embedding, undefined);
  });
});

// ── Route: guests persist nothing, and are capped at 3 a day ────────────────

describe('POST /api/profiles/coach/tailor-preview (guest)', () => {
  let server;
  let base;
  const aiCalls = [];

  before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    const realRepair = require('./resumeParserService').repairTruncatedJSON;
    const stub = (rel, exports) => {
      const p = require.resolve(rel);
      require.cache[p] = { id: p, filename: p, loaded: true, exports };
    };
    // Models: reads allowed (the limiter counts), any write recorded and failed.
    const failWrite = (name) => async () => { writes.push(name); throw new Error(`unexpected write ${name}`); };
    stub('../models', new Proxy({}, {
      get: (_t, modelName) => ({
        count: async () => 0,
        findOne: async () => null,
        findByPk: async () => null,
        findAll: async () => [],
        create: failWrite(`${String(modelName)}.create`),
        update: failWrite(`${String(modelName)}.update`),
        upsert: failWrite(`${String(modelName)}.upsert`),
        bulkCreate: failWrite(`${String(modelName)}.bulkCreate`),
        destroy: failWrite(`${String(modelName)}.destroy`),
      }),
    }));
    stub('../middleware/auth', Object.assign((req, res, next) => next(), { optionalAuth: (req, res, next) => next() }));
    stub('../middleware/aiRateLimiter', {
      aiRateLimiter: () => () => { throw new Error('signed-in limiter must not run for a guest'); },
      recordAIUsage: failWrite('recordAIUsage'),
    });
    stub('./resumeParserService', {
      tailorProfileForJob: async (...args) => { aiCalls.push('tailor'); return { success: true, data: TAILORED }; },
      repairTruncatedJSON: realRepair,
    });
    stub('./aiService', {
      generateText: async () => { aiCalls.push('match'); return JSON.stringify(MATCH_READ); },
    });

    const express = require('express');
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/profiles/coach', require('../routes/coachTailor'));
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${server.address().port}/api/profiles/coach/tailor-preview`;
  });

  after(() => server && server.close());

  const post = (body, ip = '203.0.113.9') => fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify(body),
  });

  test('returns the contract and writes nothing', async () => {
    writes.length = 0;
    const res = await post({ profile: PROFILE, jobDescription: JD });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(Object.keys(body).sort(), ['company', 'jobTitle', 'match', 'success', 'tailored']);
    assert.deepEqual(Object.keys(body.match).sort(), ['gaps', 'score', 'strengths', 'summary']);
    assert.deepEqual(writes, []);
    assert.deepEqual(aiCalls.sort(), ['match', 'tailor']);
  });

  test('validation errors carry a code and do not use up the allowance', async () => {
    const ip = '198.51.100.7';
    for (let i = 0; i < 5; i++) {
      const res = await post({ profile: PROFILE, jobUrl: 'http://169.254.169.254/' }, ip);
      assert.equal(res.status, 400);
      assert.equal((await res.json()).code, 'invalid_job_url');
    }
    const ok = await post({ profile: PROFILE, jobDescription: JD }, ip);
    assert.equal(ok.status, 200);
  });

  test('a guest IP gets three previews a day', async () => {
    const ip = '192.0.2.44';
    for (let i = 0; i < 3; i++) {
      const res = await post({ profile: PROFILE, jobDescription: JD }, ip);
      assert.equal(res.status, 200, `preview ${i + 1}`);
    }
    const fourth = await post({ profile: PROFILE, jobDescription: JD }, ip);
    assert.equal(fourth.status, 429);
    assert.equal((await fourth.json()).error, 'guest_daily_limit_ip');
    assert.deepEqual(writes, []);
  });
});
