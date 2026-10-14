const { test } = require('node:test');
const assert = require('node:assert/strict');
const { companyFromJobUrl } = require('./companyFromUrl');

test('the reported case: an Ashby URL names the company', () => {
  assert.equal(companyFromJobUrl('https://jobs.ashbyhq.com/solace/87748158-42b6-4c55-91ca-8f3d95799ee9'), 'Solace');
});
test('other hosted ATSes', () => {
  assert.equal(companyFromJobUrl('https://boards.greenhouse.io/initech/jobs/42'), 'Initech');
  assert.equal(companyFromJobUrl('https://jobs.lever.co/hooli/abc'), 'Hooli');
  assert.equal(companyFromJobUrl('https://acme.wd5.myworkdayjobs.com/en-US/External/job/x'), 'Acme');
});
test('a job board never becomes the company', () => {
  assert.equal(companyFromJobUrl('https://www.linkedin.com/jobs/view/123/'), '');
  assert.equal(companyFromJobUrl('https://www.indeed.com/viewjob?jk=1'), '');
});
test('a careers site yields the brand', () => {
  assert.equal(companyFromJobUrl('https://careers.northwind.com/jobs/1'), 'Northwind');
});
test('junk is harmless', () => {
  assert.equal(companyFromJobUrl(''), '');
  assert.equal(companyFromJobUrl('not a url'), '');
});
