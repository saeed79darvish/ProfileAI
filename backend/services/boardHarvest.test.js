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

test('demo boards, agencies, tiers and names', () => {
  for (const d of ['levertest', 'leverdemo-8', 'acme-demo', 'test', 'my-sandbox', 'ashbytest']) assert.equal(h.isDemoSlug(d), true, d);
  for (const d of ['waymo', 'testbed-labs-x', 'contest', 'zoox', 'latest']) assert.equal(h.isDemoSlug(d), d === 'testbed-labs-x' ? false : false, d);
  for (const a of ['true-talent-solutions-partners', 'Harnham', 'Acme Staffing', 'berkley-hunt', 'executive-search-group', 'Robert Half']) assert.equal(h.isAgencyName(a), true, a);
  for (const a of ['Waymo', 'DoorDash USA', 'Astranis', 'Talentful Software']) assert.equal(h.isAgencyName(a), false, a);
  assert.equal(h.tierOf({ us: 0, bayArea: 0 }), null);
  assert.equal(h.tierOf({ us: 3, bayArea: 1 }), 'A');
  assert.equal(h.tierOf({ us: 9, bayArea: 0 }), 'B');
  assert.equal(h.tierOf({ us: 2, bayArea: 0 }), null);
  assert.equal(h.nameFromTitle('Wayve Jobs'), 'Wayve');
  assert.equal(h.nameFromTitle('Zoox'), 'Zoox');
  assert.equal(h.nameFromTitle('Jobs at Acme'), 'Acme');
  assert.equal(h.nameFromTitle('Acme | Careers'), 'Acme');
  assert.equal(h.nameFromTitle('x'.repeat(80)), null);
});

test('tech share of a board, from job titles', () => {
  for (const x of ['Senior Software Engineer', 'Machine Learning Engineer', 'Product Manager, Payments', 'Staff Data Scientist', 'Security Engineer', 'Product Designer', 'iOS Developer', 'Solutions Architect']) assert.equal(h.isTechTitle(x), true, x);
  for (const x of ['Registered Nurse', 'Account Executive', 'Recruiter', 'Office Manager', 'Clinical Research Associate', 'Warehouse Associate', '']) assert.equal(h.isTechTitle(x), false, x);
  const board = { jobs: [
    { title: 'Software Engineer', location: { name: 'San Francisco, CA' } }, { title: 'Backend Engineer', location: { name: 'London, UK' } },
    { title: 'Account Executive', location: { name: 'New York, NY' } }, { title: 'Data Scientist', location: { name: 'Remote - US' } },
  ] };
  assert.deepEqual(h.techCounts('greenhouse', board), { jobs: 4, tech: 3, techBay: 1, techUs: 2 });
  assert.equal(h.isTechBoard({ jobs: 4, tech: 3, techBay: 1, techUs: 2 }), false); // only 2 tech jobs in the US
  assert.equal(h.isTechBoard({ jobs: 20, tech: 6, techBay: 2, techUs: 5 }), true);
  assert.equal(h.isTechBoard({ jobs: 100, tech: 4, techBay: 4, techUs: 4 }), false); // few tech jobs and a low share
  assert.equal(h.isTechBoard({ jobs: 8, tech: 3, techBay: 3, techUs: 3 }), true); // small board, mostly tech
  assert.equal(h.isTechBoard(null), false);
  assert.deepEqual(h.techCounts('lever', [{ text: 'Platform Engineer', categories: { location: 'Sunnyvale, CA' } }]), { jobs: 1, tech: 1, techBay: 1, techUs: 1 });
});
