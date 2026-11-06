const test = require('node:test');
const assert = require('node:assert/strict');
const svc = require('./interviewPrepService');

const NOW = new Date('2026-11-06T00:00:00Z');
const longText = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

const result = (i, extra = {}) => ({
  title: `Acme interview ${i}`, url: `https://reddit.com/r/jobs/${i}`, site: 'reddit.com',
  publishedAt: '2026-09-01T00:00:00.000Z', content: `Acme software engineer interview report ${i}. They asked about caching and design.`, ...extra,
});

/** Model mock: answers by purpose. extract returns a question per source it sees. */
function mockModel({ extract, dedupe, summary } = {}) {
  const calls = [];
  const fn = async (call) => {
    calls.push(call.purpose);
    if (call.purpose === 'extract') return extract ? extract(call) : '{}';
    if (call.purpose === 'dedupe') return dedupe ? dedupe(call) : '{"groups":[]}';
    if (call.purpose === 'summary') return summary ? summary(call) : '{"summary":"Candidates describe a phone screen then an onsite."}';
    throw new Error('unexpected');
  };
  fn.calls = calls;
  return fn;
}

test('keys: company and role normalization', () => {
  assert.equal(svc.companyKeyOf('Acme, Inc.'), 'acme');
  assert.equal(svc.roleKeyOf('Senior Software Engineer!'), svc.roleKeyOf('software engineer, senior'));
});

test('dedupes urls, drops results older than 12 months, caps at 12, counts frequency', async () => {
  const seenQueries = [];
  const search = async ({ query }) => {
    seenQueries.push(query);
    const list = Array.from({ length: 8 }, (_, i) => result(i + 1));
    list.push(result(99, { publishedAt: '2025-01-01T00:00:00.000Z' })); // too old
    list.push(result(1, { url: 'https://www.reddit.com/r/jobs/1/?utm_source=x' })); // dup
    list.push(result(50, { publishedAt: null, url: 'https://x.com/undated' })); // undated kept
    return list;
  };
  const seenBatches = [];
  const runModel = mockModel({
    extract: (call) => {
      seenBatches.push(call.prompt);
      return JSON.stringify({ questions: [{ text: 'Design a URL shortener for scale', category: 'system_design', sources: [0, 1] }] });
    },
  });
  const p = await svc.researchInterview({ company: 'Acme', jobTitle: 'Software Engineer', search, runModel, now: NOW });
  assert.ok(seenQueries.length >= 4 && seenQueries.length <= 6);
  assert.ok(seenQueries.some((q) => /interview questions/.test(q)));
  assert.equal(seenBatches.length, 3); // 9 distinct fresh results (4+4+1)
  assert.ok(seenBatches.every((b) => !b.includes('/99')));
  assert.equal(p.questions.length, 1); // same normalized text in every batch merges
  assert.equal(p.questions[0].frequency, 5);
  assert.equal(p.questions[0].sourceIds.length, 5);
  assert.equal(p.questions[0].mostRecent, '2026-09-01T00:00:00.000Z');
  assert.equal(p.coverage, 'thin'); // 1 question < 5
  assert.equal(p.sources.length, 5);
  assert.ok(p.sources.every((s) => s.excerpt.length <= 300 && s.url));
  assert.equal(p.disclaimer, svc.DISCLAIMER);
});

test('coverage thresholds', () => {
  const q = (n, ids) => Array.from({ length: n }, (_, i) => ({ sourceIds: ids }));
  assert.equal(svc.coverageOf([]), 'none');
  assert.equal(svc.coverageOf(q(4, ['s1', 's2', 's3'])), 'thin');
  assert.equal(svc.coverageOf(q(5, ['s1', 's2'])), 'thin');
  assert.equal(svc.coverageOf(q(5, ['s1', 's2', 's3'])), 'good');
});

test('no search results gives coverage none without calling the model', async () => {
  const runModel = mockModel();
  const p = await svc.researchInterview({ company: 'Acme', jobTitle: 'Chef', search: async () => [], runModel, now: NOW });
  assert.equal(p.coverage, 'none');
  assert.deepEqual(p.questions, []);
  assert.equal(runModel.calls.length, 0);
});

test('all searches failing rethrows; partial failure is tolerated', async () => {
  await assert.rejects(svc.researchInterview({ company: 'A', jobTitle: 'B', search: async () => { throw new Error('boom'); }, runModel: mockModel(), now: NOW }), /boom/);
  let n = 0;
  const search = async () => { n += 1; if (n % 2) throw new Error('x'); return [result(n)]; };
  const p = await svc.researchInterview({ company: 'Acme', jobTitle: 'Engineer', search, runModel: mockModel(), now: NOW });
  assert.equal(p.coverage, 'none');
});

test('invalid model JSON: one bad batch is skipped, all bad batches fail the run', async () => {
  const search = async () => Array.from({ length: 8 }, (_, i) => result(i + 1));
  let call = 0;
  const half = mockModel({ extract: () => { call += 1; return call === 1 ? 'not json at all' : JSON.stringify({ questions: [{ text: 'Explain eventual consistency', category: 'coding', sources: [0] }] }); } });
  const p = await svc.researchInterview({ company: 'Acme', jobTitle: 'Engineer', search, runModel: half, now: NOW });
  assert.equal(p.questions.length, 1);

  const bad = mockModel({ extract: () => 'nonsense' });
  await assert.rejects(svc.researchInterview({ company: 'Acme', jobTitle: 'Engineer', search, runModel: bad, now: NOW }), { code: 'model_failed' });
});

test('a truncated model reply is repaired', async () => {
  const search = async () => [result(1)];
  const runModel = mockModel({ extract: () => '{"questions":[{"text":"Walk me through a hard bug","category":"behavioral","sources":[0]},{"text":"Trunc' });
  const p = await svc.researchInterview({ company: 'Acme', jobTitle: 'Engineer', search, runModel, now: NOW });
  assert.ok(p.questions.some((q) => q.text === 'Walk me through a hard bug'));
});

test('items without a valid source index are dropped (no invention)', async () => {
  const search = async () => [result(1)];
  const runModel = mockModel({ extract: () => JSON.stringify({ questions: [
    { text: 'Question with real source here', category: 'coding', sources: [0] },
    { text: 'Question with no source at all', category: 'coding', sources: [] },
    { text: 'Question with bogus source index', category: 'coding', sources: [7] },
  ], rounds: [{ name: 'Onsite', format: 'x', notes: 'y', sources: [5] }] }) });
  const p = await svc.researchInterview({ company: 'Acme', jobTitle: 'Engineer', search, runModel, now: NOW });
  assert.deepEqual(p.questions.map((q) => q.text), ['Question with real source here']);
  assert.deepEqual(p.process.rounds, []);
});

test('near-duplicate model pass merges groups; bad groups are ignored', async () => {
  const search = async () => [result(1), result(2)];
  const extract = () => JSON.stringify({ questions: [
    { text: 'Reverse a linked list', category: 'coding', sources: [0] },
    { text: 'Write code that reverses a singly linked list', category: 'coding', sources: [1] },
    { text: 'Tell me about a conflict', category: 'behavioral', sources: [0] },
  ] });
  const p = await svc.researchInterview({ company: 'Acme', jobTitle: 'Engineer', search, runModel: mockModel({ extract, dedupe: () => '{"groups":[[0,1],[99,2]]}' }), now: NOW });
  assert.equal(p.questions.length, 2);
  assert.equal(p.questions[0].frequency, 2);
  assert.equal(p.questions[0].text, 'Reverse a linked list');
  assert.equal(p.questions[0].id, 'q1');
});

test('sorted by frequency then recency', () => {
  const sources = new Map([
    ['u1', { title: 'a', url: 'u1', site: 's', date: '2026-01-01T00:00:00.000Z', excerpt: '' }],
    ['u2', { title: 'b', url: 'u2', site: 's', date: '2026-06-01T00:00:00.000Z', excerpt: '' }],
    ['u3', { title: 'c', url: 'u3', site: 's', date: '2026-03-01T00:00:00.000Z', excerpt: '' }],
  ]);
  const p = svc.assemblePayload({ company: 'A', role: 'B', now: NOW, sources, questions: [
    { text: 'older single question', category: 'coding', urls: ['u1'] },
    { text: 'newer single question', category: 'coding', urls: ['u2'] },
    { text: 'popular question here', category: 'coding', urls: ['u1', 'u3'] },
  ] });
  assert.deepEqual(p.questions.map((q) => q.text), ['popular question here', 'newer single question', 'older single question']);
});

test('excerpt is capped at 300 chars and quotes never exceed 25 consecutive words', async () => {
  const content = `Acme interview. ${longText(60)}`;
  const search = async () => [result(1, { content })];
  const copied = longText(40); // 40 consecutive words copied from the source
  const runModel = mockModel({ extract: () => JSON.stringify({ questions: [{ text: `${copied}`, category: 'other', sources: [0] }] }) });
  const p = await svc.researchInterview({ company: 'Acme', jobTitle: 'Engineer', search, runModel, now: NOW });
  assert.ok(p.sources[0].excerpt.length <= 300);
  assert.ok(p.questions[0].text.split(' ').length <= 25);
  const guard = svc.makeQuoteGuard([content]);
  assert.equal(guard(longText(10)), longText(10));
});

test('personalizeProbes validates and trims', async () => {
  const prep = { company: 'A', role: 'B', topics: [], questions: [{ text: 'x question here', category: 'coding' }] };
  const profile = { title: 'Engineer', summary: 'Built things', experience: [{ company: 'Z' }] };
  const probes = await svc.personalizeProbes({ prep, profile, runModel: async () => JSON.stringify({ probes: Array.from({ length: 8 }, (_, i) => ({ question: `Q${i}`, why: 'w', basedOn: 'Z job' })).concat([{ question: 'no basis', why: 'w', basedOn: '' }]) }) });
  assert.equal(probes.length, 6);
  await assert.rejects(svc.personalizeProbes({ prep, profile: {}, runModel: async () => '{}' }), { code: 'profile_empty' });
  await assert.rejects(svc.personalizeProbes({ prep, profile, runModel: async () => 'garbage' }), { code: 'personalize_failed' });
});
