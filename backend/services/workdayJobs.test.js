const test = require('node:test');
const assert = require('node:assert/strict');
const w = require('./workdayJobs');

const helpers = {
  stripHtml: (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  inferLocationType: (loc, title) => (/remote/i.test(`${loc} ${title}`) ? 'remote' : 'onsite'),
  normalizeEmploymentType: (v) => (/full/i.test(v || '') ? 'full-time' : null),
  inferExperienceLevel: (t) => (/senior/i.test(t || '') ? 'senior' : null),
  sanitizeExternalUrl: (u) => u || null,
};
const NOW = new Date('2026-11-09T12:00:00Z');
const TOKEN = 'acme|wd5|AcmeCareers';
const posting = (n, where = 'US, CA, Santa Clara', extra = {}) => ({ title: `Senior Engineer ${n}`, externalPath: `/job/x/Engineer-${n}_JR${1000 + n}`, locationsText: where, postedOn: 'Posted Today', bulletFields: [`JR${1000 + n}`], ...extra });

/** A fake Workday: `list` rows in order, details by externalPath, counts the calls it gets. */
function fakeWorkday({ list, details = {}, total, status = 200, detailStatus = 200 }) {
  const calls = { list: 0, detail: 0 };
  const fetchImpl = async (url, init) => {
    if (init && init.method === 'POST') {
      calls.list += 1;
      if (status !== 200) return { ok: false, status, json: async () => ({}) };
      const { offset, limit } = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ total: total ?? list.length, jobPostings: list.slice(offset, offset + limit) }) };
    }
    calls.detail += 1;
    const path = url.split('/AcmeCareers')[1];
    if (detailStatus !== 200) return { ok: false, status: detailStatus, json: async () => ({}) };
    const d = details[path];
    return d ? { ok: true, status: 200, json: async () => ({ jobPostingInfo: d }) } : { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetchImpl, calls };
}
const run = (fake, opts = {}) => w.createWorkday(helpers).fetchWorkdayJobs(TOKEN, { fetchImpl: fake.fetchImpl, pauseMs: 0, sleep: async () => {}, now: NOW, ...opts });
const info = (n, extra = {}) => ({ title: `Senior Engineer ${n}`, jobDescription: `<p>Build things ${n}</p>`, location: 'US, CA, Santa Clara', timeType: 'Full time', startDate: '2026-11-08', externalUrl: `https://acme.wd5.myworkdayjobs.com/AcmeCareers/job/x/Engineer-${n}_JR${1000 + n}`, country: { descriptor: 'United States of America' }, ...extra });

test('parseToken accepts tenant|wdN|site and nothing else', () => {
  assert.deepEqual(w.parseToken('NVIDIA|wd5|NVIDIAExternalCareerSite'), { tenant: 'nvidia', wd: 'wd5', site: 'NVIDIAExternalCareerSite' });
  for (const bad of ['', 'nvidia', 'nvidia|5|Site', 'a b|wd5|Site', 'x|wd5|', null, 'x|wd5|a/b']) assert.equal(w.parseToken(bad), null, String(bad));
});

test('usOf: US places, other countries, and the unclear "4 Locations"', () => {
  for (const t of ['US, CA, Santa Clara', 'Santa Clara, California', 'San Jose, CA', 'Remote, US', 'United States of America', 'New York, NY, US']) assert.equal(w.usOf(t), 'us', t);
  for (const t of ['India, Pune', 'Germany, Munich', 'London, United Kingdom', 'Toronto, ON', 'Remote Ireland']) assert.equal(w.usOf(t), 'other', t);
  for (const t of ['Austin', 'San Jose', 'Shanghai', 'Dublin']) assert.equal(w.usOf(t), 'unknown', t); // a bare city: the detail settles it
  assert.equal(w.usOf('4 Locations'), 'unknown');
  assert.equal(w.usOf(''), 'unknown');
});

test('postedAtFromText reads Workday wording', () => {
  assert.equal(w.postedAtFromText('Posted Today', NOW).toISOString().slice(0, 10), '2026-11-09');
  assert.equal(w.postedAtFromText('Posted Yesterday', NOW).toISOString().slice(0, 10), '2026-11-08');
  assert.equal(w.postedAtFromText('Posted 3 Days Ago', NOW).toISOString().slice(0, 10), '2026-11-06');
  assert.equal(w.postedAtFromText('Posted 30+ Days Ago', NOW).toISOString().slice(0, 10), '2026-10-10');
  assert.equal(w.postedAtFromText('', NOW), null);
});

test('idOf prefers the requisition id', () => {
  assert.equal(w.idOf({ bulletFields: ['JR2028599'], externalPath: '/job/a/b_JR1' }), 'JR2028599');
  assert.equal(w.idOf({ bulletFields: [], externalPath: '/job/a/Manager--Firmware_JR2028599' }), 'JR2028599');
});

test('reads every page, keeps US jobs, fetches detail for new ones, builds records', async () => {
  const list = [posting(1), posting(2, 'India, Pune'), posting(3, '4 Locations'), posting(4, '2 Locations'), ...Array.from({ length: 22 }, (_, i) => posting(10 + i))];
  const details = {};
  for (const p of list) details[p.externalPath] = info(Number(p.externalPath.match(/Engineer-(\d+)_/)[1]));
  details[list[3].externalPath] = info(4, { location: 'Berlin, Germany', country: { descriptor: 'Germany' } }); // multi-location, not US
  const fake = fakeWorkday({ list, details });
  const out = await run(fake);
  assert.equal(fake.calls.list, 2); // 26 rows is two pages of 20
  assert.equal(out.listed, 26);
  const ids = out.jobs.map((j) => j.externalId);
  assert.ok(!ids.includes('JR1002'), 'India job dropped');
  assert.ok(ids.includes('JR1003'), 'unclear job kept because its detail says US');
  assert.ok(!ids.includes('JR1004'), 'unclear job dropped because its detail says Germany');
  const j = out.jobs.find((x) => x.externalId === 'JR1001');
  assert.equal(j.source, 'workday');
  assert.equal(j.boardToken, TOKEN);
  assert.equal(j.title, 'Senior Engineer 1');
  assert.equal(j.description, 'Build things 1');
  assert.equal(j.employmentType, 'full-time');
  assert.equal(j.experienceLevel, 'senior');
  assert.equal(j.postedAt.toISOString().slice(0, 10), '2026-11-08');
  assert.match(j.applyUrl, /^https:\/\/acme\.wd5\.myworkdayjobs\.com\/AcmeCareers\/job\//);
});

test('a job we already hold is not fetched again and keeps its stored text', async () => {
  const list = [posting(1), posting(2)];
  const fake = fakeWorkday({ list, details: { [list[1].externalPath]: info(2) } });
  const existing = new Map([['JR1001', { description: 'stored text', descriptionHtml: '<p>stored</p>', employmentType: 'full-time', postedAt: new Date('2026-10-01') }]]);
  const out = await run(fake, { existing });
  assert.equal(fake.calls.detail, 1);
  const kept = out.jobs.find((j) => j.externalId === 'JR1001');
  assert.equal(kept.description, 'stored text');
  assert.equal(kept.postedAt.toISOString().slice(0, 10), '2026-10-01');
});

test('only a capped number of new details are fetched per sync; the rest wait', async () => {
  const list = Array.from({ length: 7 }, (_, i) => posting(i + 1));
  const details = Object.fromEntries(list.map((p, i) => [p.externalPath, info(i + 1)]));
  const fake = fakeWorkday({ list, details });
  const out = await run(fake, { maxNewDetails: 3 });
  assert.equal(out.jobs.length, 3);
  assert.equal(out.newDetails, 3);
  assert.equal(out.deferred, 4);
  assert.equal(fake.calls.detail, 3);
});

test('refuses to call an empty or odd reply an empty board, and tags the errors that matter', async () => {
  await assert.rejects(run(fakeWorkday({ list: [] })), /refusing to treat the board as empty/);
  await assert.rejects(run({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ nope: true }) }) }), /did not look like a job list/);
  await assert.rejects(run(fakeWorkday({ list: [posting(1)], status: 404 })), (e) => e.isGone === true && e.status === 404);
  await assert.rejects(run(fakeWorkday({ list: [posting(1)], status: 429 })), (e) => e.isRateLimit === true);
  await assert.rejects(w.createWorkday(helpers).fetchWorkdayJobs('bad token'), /must look like/);
});

test('a detail that fails is skipped, not fatal, and is retried on a later sync', async () => {
  const list = [posting(1), posting(2)];
  const fake = fakeWorkday({ list, details: { [list[0].externalPath]: info(1) } });
  const out = await run(fake);
  assert.deepEqual(out.jobs.map((j) => j.externalId), ['JR1001']);
});

test('a busy Workday that answers 5xx once is asked again; a steady 5xx still fails', async () => {
  let n = 0;
  const flaky = async (url, init) => {
    if (init && init.method === 'POST') { n += 1; if (n === 1) return { ok: false, status: 502, json: async () => ({}) }; return { ok: true, status: 200, json: async () => ({ total: 1, jobPostings: [posting(1)] }) }; }
    return { ok: true, status: 200, json: async () => ({ jobPostingInfo: info(1) }) };
  };
  const out = await run({ fetchImpl: flaky }, { retryMs: 0 });
  assert.equal(out.jobs.length, 1);
  await assert.rejects(run({ fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) }, { retryMs: 0 }), /HTTP 503/);
});

test('every Workday board in the seed list has a valid token and a unique name', () => {
  const { SEED_BOARDS } = require('../config/seedBoards');
  const boards = SEED_BOARDS.filter((b) => b.platform === 'workday');
  assert.ok(boards.length >= 10);
  for (const b of boards) assert.ok(w.parseToken(b.boardToken), b.boardToken);
  assert.equal(new Set(boards.map((b) => b.boardToken)).size, boards.length);
});

test('a "2 Locations" job is classified by the main place in its own address, without a detail request', async () => {
  assert.equal(w.placeFromPath('/job/India---Bangalore/Software-Engineer_JR1'), 'India - Bangalore');
  assert.equal(w.placeFromPath('/job/US-CA-San-Francisco/Engineer_JR2'), 'US CA San Francisco');
  assert.equal(w.usFromPath('/job/Germany---Munich/x'), 'other');
  assert.equal(w.usFromPath('/job/US-CA-Santa-Clara/x'), 'us');
  assert.equal(w.usFromPath('/job/USA---Remote/x'), 'us');
  assert.equal(w.usFromPath('/job/California---San-Francisco/x'), 'unknown'); // unclear: settled by the detail, never dropped on a guess
  assert.equal(w.usFromPath('/job/x/y'), 'unknown');
  const list = [
    posting(1, '2 Locations', { externalPath: '/job/India---Bangalore/Engineer-1_JR1001' }),
    posting(2, '2 Locations', { externalPath: '/job/Germany---Munich/Engineer-2_JR1002' }),
    posting(3, '2 Locations', { externalPath: '/job/US-CA-San-Francisco/Engineer-3_JR1003' }),
  ];
  const fake = fakeWorkday({ list, details: { [list[2].externalPath]: info(3) } });
  const out = await run(fake);
  assert.deepEqual(out.jobs.map((j) => j.externalId), ['JR1003']);
  assert.equal(fake.calls.detail, 1);
});

test('bare-city jobs are settled by their detail, and a non-US one is not asked about again by the same process', async () => {
  const list = [posting(1, 'Austin'), posting(2, 'Shanghai')];
  const details = { [list[0].externalPath]: info(1), [list[1].externalPath]: info(2, { location: 'Shanghai', country: { descriptor: 'China' } }) };
  const fake = fakeWorkday({ list, details });
  const wd = w.createWorkday(helpers);
  const opts = { fetchImpl: fake.fetchImpl, pauseMs: 0, sleep: async () => {}, now: NOW };
  const first = await wd.fetchWorkdayJobs(TOKEN, opts);
  assert.deepEqual(first.jobs.map((j) => j.externalId), ['JR1001']);
  assert.equal(fake.calls.detail, 2);
  const second = await wd.fetchWorkdayJobs(TOKEN, opts);
  assert.equal(fake.calls.detail, 3); // only the stored-less US job is asked again; Shanghai is remembered
  assert.deepEqual(second.jobs.map((j) => j.externalId), ['JR1001']);
});
