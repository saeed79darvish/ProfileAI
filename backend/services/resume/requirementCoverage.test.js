const { test } = require('node:test');
const assert = require('node:assert/strict');

const { matchFromRequirements } = require('./requirementCoverage');
const { normalizeRequirementsRead } = require('./jobRequirementsRead');

const NOW = new Date();
const thisYear = NOW.getFullYear();
const PROFILE = {
  title: 'Staff Front-end UI Architect',
  skills: { technical: ['React', 'TypeScript', 'GraphQL', 'Kubernetes'] },
  experience: [
    { title: 'Lead UI Software Development Engineer', company: 'Amazon AWS', startDate: `${thisYear - 2}-05`, endDate: 'Present', description: 'Built the React and TypeScript video player platform for 1M+ users.\nCut data retrieval 30% with a BFF in Node.js.' },
    { title: 'Senior UI Engineer', company: 'Restoration Hardware', startDate: `${thisYear - 4}-08`, endDate: `${thisYear - 2}-05`, description: 'Payments UI in React.' },
    { title: 'Software Engineer', company: 'PayPal', startDate: '2012-01', endDate: '2016-05', description: 'Checkout in Angular.' },
  ],
  education: [{ degree: 'B.S.', field: 'Computer Science', institution: 'SJSU' }],
};

const READ = normalizeRequirementsRead({
  roleNouns: ['engineer'],
  requirements: [
    { requirement: '5+ years building web apps', type: 'experience_years', hardness: 'must', terms: ['web'], years: 5 },
    { requirement: 'React and TypeScript', type: 'skill', hardness: 'must', terms: ['react', 'typescript'] },
    { requirement: 'Angular', type: 'skill', hardness: 'nice', terms: ['angular'] },
    { requirement: 'Kubernetes', type: 'skill', hardness: 'nice', terms: ['kubernetes', 'k8s'] },
    { requirement: 'Game economy or payments domain', type: 'domain', hardness: 'nice', terms: ['game economy', 'virtual currency'] },
    { requirement: "Bachelor's degree in CS", type: 'education', hardness: 'must', terms: ['computer science'] },
    { requirement: 'Mentor junior engineers', type: 'responsibility', hardness: 'must', terms: [] },
    { requirement: 'Strong communicator', type: 'soft', hardness: 'must', terms: [] },
  ],
});

test('coverage follows the AI match bar: recent role strong, old role or skills list partial', () => {
  const m = matchFromRequirements(READ, PROFILE);
  const by = Object.fromEntries(m.requirements.map((r) => [r.requirement, r.status]));
  assert.equal(by['5+ years building web apps'], 'met');
  assert.equal(by['React and TypeScript'], 'met');
  assert.equal(by.Angular, 'partial');            // only in a role that ended 2016
  assert.equal(by.Kubernetes, 'partial');         // skills list only
  assert.equal(by['Game economy or payments domain'], 'missing');
  assert.equal(by["Bachelor's degree in CS"], 'met');
  // Duties and uncheckable soft skills are not listed or scored.
  assert.ok(!('Mentor junior engineers' in by));
  assert.ok(!('Strong communicator' in by));
  assert.equal(m.total, 6);
  assert.equal(m.met, 3);
  assert.ok(m.score > 50 && m.score < 100, String(m.score));
});

test('a different job family scores lower through role fit', () => {
  const design = { ...READ, roleNouns: ['designer'] };
  assert.ok(matchFromRequirements(design, PROFILE).score < matchFromRequirements(READ, PROFILE).score);
});

test('terms match whole words only', () => {
  const read = normalizeRequirementsRead({ requirements: [{ requirement: 'Go', type: 'skill', terms: ['go'] }] });
  assert.equal(matchFromRequirements(read, PROFILE).requirements[0].status, 'missing'); // "good"/"google" are not Go
});

test('unusable model output stores nothing', () => {
  assert.equal(normalizeRequirementsRead({ requirements: [] }), null);
  assert.equal(normalizeRequirementsRead('nope'), null);
});

test('role fit matches the head word of a multi-word role', () => {
  const read = { ...READ, roleNouns: ['software engineer', 'frontend engineer'] };
  assert.equal(matchFromRequirements(read, PROFILE).score, matchFromRequirements(READ, PROFILE).score);
});

test('a years requirement without a number is checked by its terms', () => {
  const read = normalizeRequirementsRead({ requirements: [{ requirement: 'Large-scale consumer products', type: 'experience_years', terms: ['video player'] }] });
  assert.equal(read.requirements[0].type, 'skill');
  assert.equal(matchFromRequirements(read, PROFILE).requirements[0].status, 'met');
});

test('scale phrases match the way resumes state scale', () => {
  const read = normalizeRequirementsRead({ requirements: [{ requirement: 'Large-scale consumer products', type: 'skill', terms: ['millions of users'] }] });
  const profile = { experience: [{ title: 'Engineer', endDate: 'Present', description: 'Platform built for 1M+ monthly users.' }] };
  assert.equal(matchFromRequirements(read, profile).requirements[0].status, 'met');
  const none = { experience: [{ title: 'Engineer', endDate: 'Present', description: 'Shipped 3 features.' }] };
  assert.equal(matchFromRequirements(read, none).requirements[0].status, 'missing');
});
