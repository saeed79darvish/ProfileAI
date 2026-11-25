const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const b = require('./boardImport');

test('parseCsv handles quoted commas, doubled quotes and CRLF', () => {
  const rows = b.parseCsv('ats,slug,company_name,open_jobs\r\ngreenhouse,acme,"Acme, Inc.",12\r\nashby,beta,"The ""Beta"" Co",3\n');
  assert.deepEqual(rows, [
    { ats: 'greenhouse', slug: 'acme', company_name: 'Acme, Inc.', open_jobs: '12' },
    { ats: 'ashby', slug: 'beta', company_name: 'The "Beta" Co', open_jobs: '3' },
  ]);
});

test('candidatesFromRows keeps systems we can read, cleans slugs, drops duplicates and junk', () => {
  const out = b.candidatesFromRows([
    { ats: 'greenhouse', slug: 'Stripe', company_name: 'Stripe', open_jobs: '500' },
    { ats: 'greenhouse', slug: 'stripe', company_name: 'Stripe', open_jobs: '500' },
    { ats: 'workable', slug: 'acme', company_name: 'Acme', open_jobs: '9' },
    { ats: 'lever', slug: '12345', company_name: '', open_jobs: '2' },
    { ats: 'ashby', slug: 'openai', company_name: '', open_jobs: 'x' },
  ], 'storesignal');
  assert.deepEqual(out, [
    { platform: 'greenhouse', boardToken: 'stripe', name: 'Stripe', source: 'storesignal', sizeHint: 500 },
    { platform: 'ashby', boardToken: 'openai', name: null, source: 'storesignal', sizeHint: 0 },
  ]);
});

const gh = (jobs) => ({ jobs: jobs.map(([title, location]) => ({ title, location: { name: location }, company_name: 'Acme' })) });

test('judgeBoard scores US tech jobs above plain US jobs', () => {
  const tech = b.judgeBoard({ platform: 'greenhouse', boardToken: 'acme' }, gh([
    ...Array.from({ length: 20 }, (_, i) => [`Senior Software Engineer ${i}`, 'San Francisco, CA']),
    ['Account Executive', 'New York, NY'], ['Engineer', 'London, UK'],
  ]));
  assert.equal(tech.techUs, 20);
  assert.equal(tech.status, 'validated');
  assert.equal(tech.name, 'Acme');
  const retail = b.judgeBoard({ platform: 'greenhouse', boardToken: 'shop' }, gh(Array.from({ length: 150 }, () => ['Store Associate', 'Dallas, TX'])));
  assert.equal(retail.status, 'validated');
  assert.ok(tech.score > retail.score, `${tech.score} > ${retail.score}`);
  const giant = b.judgeBoard({ platform: 'greenhouse', boardToken: 'gym' }, gh(Array.from({ length: 5000 }, () => ['Personal Trainer', 'Phoenix, AZ'])));
  const small = b.judgeBoard({ platform: 'greenhouse', boardToken: 'tiny' }, gh(Array.from({ length: 11 }, (_, i) => [`Software Engineer ${i}`, 'Denver, CO'])));
  assert.ok(small.score > giant.score, `${small.score} > ${giant.score}`);
});

test('judgeBoard rejects empty, non-US, agency, demo and malformed boards', () => {
  assert.equal(b.judgeBoard({ platform: 'greenhouse', boardToken: 'acme' }, { jobs: [] }).reason, 'empty');
  assert.equal(b.judgeBoard({ platform: 'greenhouse', boardToken: 'acme' }, gh([['Engineer', 'Berlin, Germany']])).reason, 'no_us');
  assert.equal(b.judgeBoard({ platform: 'greenhouse', boardToken: 'acme-staffing' }, gh([['Engineer', 'Austin, TX']])).reason, 'agency');
  assert.equal(b.judgeBoard({ platform: 'ashby', boardToken: 'acme-demo' }, { jobs: [{ title: 'Engineer', location: 'Austin, TX' }] }).reason, 'demo');
  assert.equal(b.judgeBoard({ platform: 'lever', boardToken: 'acme' }, { jobs: [] }).reason, 'not_a_board');
  const lev = [{ text: 'Software Engineer', categories: { location: 'Austin, TX' } }];
  assert.equal(b.judgeBoard({ platform: 'lever', boardToken: 'jobgether' }, lev).reason, 'reposter');
  assert.equal(b.judgeBoard({ platform: 'lever', boardToken: 'aogarciaagency' }, lev).reason, 'reposter');
  assert.equal(b.judgeBoard({ platform: 'lever', boardToken: 'agencyanalytics' }, lev).status, 'validated');
});

test('roomToPromote never goes over the cap', () => {
  assert.equal(b.roomToPromote(750, 750, 25), 0);
  assert.equal(b.roomToPromote(760, 750, 25), 0);
  assert.equal(b.roomToPromote(740, 750, 25), 10);
  assert.equal(b.roomToPromote(100, 750, 25), 25);
});

test('the bundled StoreSignal file parses into thousands of supported candidates', () => {
  const out = b.candidatesFromRows(b.parseCsv(fs.readFileSync(b.STORESIGNAL_FILE, 'utf8')), 'storesignal');
  assert.ok(out.length > 8000, String(out.length));
  assert.ok(out.every((c) => b.SUPPORTED.has(c.platform)));
});
