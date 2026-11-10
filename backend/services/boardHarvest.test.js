const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./boardHarvest');

test('cleanSlug keeps real board names and drops junk', () => {
  for (const ok of ['databricks', 'hinge-health', 'Wayve', 'acme.io', 'a1']) assert.ok(h.cleanSlug(ok), ok);
  assert.equal(h.cleanSlug('Wayve'), 'wayve');
  for (const bad of ['', '$company', '%7bcompany%7d', '1234567', '4e9f7a3c-1b2d-4c5e-8f90-123456789abc', 'embed', 'robots.txt', 'x'.repeat(33), '$10.2k', 'a'.repeat(80), 'undefined', null]) assert.equal(h.cleanSlug(bad), null, String(bad));
  assert.equal(h.cleanSlug('%20FoschiniRetailGroup'), 'foschiniretailgroup'); // a stray space in a real link
});

test('slugFromUrl reads a board from each system, including the Greenhouse embed form', () => {
  assert.equal(h.slugFromUrl('greenhouse', 'https://boards.greenhouse.io/vercel/jobs/12345'), 'vercel');
  assert.equal(h.slugFromUrl('greenhouse', 'https://job-boards.greenhouse.io/databricks'), 'databricks');
  assert.equal(h.slugFromUrl('greenhouse', 'https://boards.greenhouse.io/embed/job_board?for=Roblox&b=https%3A%2F%2Fx'), 'roblox');
  assert.equal(h.slugFromUrl('greenhouse', 'https://boards.greenhouse.io/embed/job_app?token=1'), null);
  assert.equal(h.slugFromUrl('lever', 'https://jobs.lever.co/zoox/abc-123?lever-via=x'), 'zoox');
  assert.equal(h.slugFromUrl('ashby', 'https://jobs.ashbyhq.com/Wayve/1111-2222'), 'wayve');
  assert.equal(h.slugFromUrl('ashby', 'https://example.com/wayve'), null);
  assert.equal(h.slugFromUrl('nope', 'https://jobs.lever.co/zoox'), null);
  assert.deepEqual(h.slugsFromUrls('lever', ['https://jobs.lever.co/a1', 'https://jobs.lever.co/a1/x', 'https://jobs.lever.co/b2?team=x', 'https://jobs.lever.co/robots.txt']).sort(), ['a1', 'b2']);
});

test('Bay Area and US locations', () => {
  for (const l of ['San Francisco, CA', 'Sunnyvale, California', 'Bay Area', 'Remote - San Francisco', 'SF Bay Area', 'Palo Alto, CA, United States']) assert.equal(h.isBayArea(l), true, l);
  for (const l of ['London, UK', 'Remote', 'New York, NY', 'Austin, TX', '']) assert.equal(h.isBayArea(l), false, l);
  for (const l of ['New York, NY', 'Remote - US', 'United States', 'Austin, TX', 'Remote (US)', 'San Jose, CA']) assert.equal(h.isUs(l), true, l);
  for (const l of ['London, UK', 'Berlin, Germany', 'Remote', 'Toronto, ON, Canada']) assert.equal(h.isUs(l), false, l);
});

test('summarizeBoard reads each feed shape and refuses a non-board reply', () => {
  assert.deepEqual(h.summarizeBoard('greenhouse', { jobs: [{ location: { name: 'San Francisco, CA' } }, { location: { name: 'London, UK' } }, { location: { name: 'New York, NY' } }] }), { jobs: 3, bayArea: 1, us: 2 });
  assert.deepEqual(h.summarizeBoard('lever', [{ categories: { location: 'Sunnyvale, CA' } }, { categories: {} }]), { jobs: 2, bayArea: 1, us: 1 });
  assert.deepEqual(h.summarizeBoard('ashby', { jobs: [{ location: 'Remote', secondaryLocations: [{ location: 'San Francisco, CA' }] }, { location: 'Paris, France' }] }), { jobs: 2, bayArea: 1, us: 1 });
  assert.equal(h.summarizeBoard('greenhouse', { error: 'x' }), null);
  assert.equal(h.summarizeBoard('lever', { jobs: [] }), null);
  assert.equal(h.summarizeBoard('ashby', null), null);
  assert.deepEqual(h.summarizeBoard('greenhouse', { jobs: [] }), { jobs: 0, bayArea: 0, us: 0 });
});
