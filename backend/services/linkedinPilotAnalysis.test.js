const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('./linkedinPilotAnalysis');

const NOW = Date.parse('2026-11-09T12:00:00Z');

test('companyKey ignores case, punctuation and company suffixes', () => {
  assert.equal(a.companyKey('Stripe, Inc.'), 'stripe');
  assert.equal(a.companyKey('Acme Labs LLC'), 'acme');
  assert.equal(a.companyKey('AT&T'), 'at and t');
});

test('sameTitle: same role in different words counts, different roles do not', () => {
  assert.equal(a.sameTitle('Senior Frontend Engineer', 'Frontend Engineer (Senior)'), true);
  assert.equal(a.sameTitle('Frontend Engineer', 'Senior Frontend Engineer, Payments'), true);
  assert.equal(a.sameTitle('Frontend Engineer', 'Backend Engineer'), false);
  assert.equal(a.sameTitle('Designer', 'Designer'), true);
  assert.equal(a.sameTitle('', 'Engineer'), false);
});

test('ageHours reads a timestamp, a date or "2 hours ago"; null when there is nothing', () => {
  assert.equal(Math.round(a.ageHours({ postedAtTimestamp: NOW - 5 * 3600000 }, NOW)), 5);
  assert.equal(Math.round(a.ageHours({ postedAt: '2026-11-08T12:00:00Z' }, NOW)), 24);
  assert.equal(Math.round(a.ageHours({ postedAtTimestamp: Math.floor((NOW - 2 * 3600000) / 1000) }, NOW)), 2);
  assert.equal(a.ageHours({ postedAtRelative: '3 days ago' }, NOW), 72);
  assert.equal(a.ageHours({ postedAtRelative: '30 minutes ago' }, NOW), 0.5);
  assert.equal(a.ageHours({}, NOW), null);
});

test('employees and startup guess', () => {
  assert.equal(a.employees({ companyEmployeesCount: 42 }), 42);
  assert.equal(a.employees({ companyEmployeesCount: '11-50 employees' }), 11);
  assert.equal(a.employees({ companyEmployeesCount: '1,200' }), 1200);
  assert.equal(a.employees({}), null);
  assert.equal(a.isStartupLike({ companyEmployeesCount: 40 }), true);
  assert.equal(a.isStartupLike({ companyEmployeesCount: 5000 }), false);
  assert.equal(a.isStartupLike({}), false);
});

test('summarize: freshness, completeness and startups as shares of the export', () => {
  const jobs = [
    { id: '1', title: 'Engineer', companyName: 'A', location: 'San Francisco, CA', postedAtTimestamp: NOW - 3 * 3600000, applyUrl: 'https://a.com/apply', salaryInfo: ['$100k'], descriptionText: 'x'.repeat(500), companyEmployeesCount: 30 },
    { id: '2', title: 'Designer', companyName: 'B', location: 'Austin, TX', postedAt: '2026-11-01T00:00:00Z', applyUrl: '', salaryInfo: [], descriptionText: 'short', companyEmployeesCount: 9000 },
    { id: '3', title: 'PM', companyName: 'B Inc', location: 'Austin, TX' },
    { title: '', companyName: '' },
    null,
  ];
  const s = a.summarize(jobs, NOW);
  assert.equal(s.jobs, 3);
  assert.equal(s.companies, 2);
  assert.equal(s.postedWithin24h, 33);
  assert.equal(s.postedWithin7d, 33);
  assert.equal(s.ageUnknown, 33);
  assert.equal(s.withApplyUrl, 33);
  assert.equal(s.withSalary, 33);
  assert.equal(s.startupLike, 33);
  assert.deepEqual(s.topLocations[0], ['Austin', 2]);
  assert.equal(a.summarize(null).jobs, 0);
});

test('overlap: counts what we already hold by company and role, and what is new, startups included', async () => {
  const ours = { stripe: [{ title: 'Frontend Engineer', company: 'Stripe' }, { title: 'Payments Designer', company: 'Stripe' }], other: [{ title: 'Chef', company: 'Somewhere Else' }] };
  const lookup = async (name) => (name.toLowerCase().includes('stripe') ? ours.stripe : name.toLowerCase().includes('tinyco') ? [] : ours.other);
  const jobs = [
    { title: 'Senior Frontend Engineer', companyName: 'Stripe, Inc.', companyEmployeesCount: 8000 },
    { title: 'Backend Engineer', companyName: 'Stripe', companyEmployeesCount: 8000 },
    { title: 'Founding Engineer', companyName: 'TinyCo', companyEmployeesCount: 12 },
  ];
  const o = await a.overlap(jobs, lookup, { pauseMs: 0 });
  assert.equal(o.companiesChecked, 2);
  assert.equal(o.companiesWeAlreadyHave, 1);
  assert.equal(o.companiesNewToUs, 1);
  assert.equal(o.jobsChecked, 3);
  assert.equal(o.alreadyCovered, 33);
  assert.equal(o.newToUs, 67);
  assert.equal(o.startupJobsChecked, 1);
  assert.equal(o.startupJobsNewToUs, 1);
});

test('the real export shape: "19 hours ago" beats a bare date, and the salary field is a string', () => {
  const now = Date.parse('2026-11-09T20:00:00Z');
  assert.equal(a.ageHours({ postedAt: '2026-11-08', postedAtRelative: '19 hours ago' }, now), 19);
  assert.equal(a.ageHours({ postedAt: '2026-11-04', postedAtRelative: '4 days ago' }, now), 96);
  assert.equal(a.hasSalary({ salary: '$210,000.00/yr - $265,000.00/yr' }), true);
  assert.equal(a.hasSalary({ salary: '' }), false);
  assert.equal(a.hasApplyUrl({ applyUrl: '' }), false);
});
