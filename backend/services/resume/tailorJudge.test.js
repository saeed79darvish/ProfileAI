const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deterministicChecks } = require('./tailorJudge');

const PROFILE = {
  title: 'Senior Software Engineer',
  skills: ['React', 'TypeScript', 'Node.js'],
  experience: [
    { company: 'Equinix', title: 'Senior UI Engineer', startDate: '2025-05-01', current: true, description: '• Built reusable AI components for the Fabric port domain.\n• Raised user engagement 25%.' },
    { company: 'Amazon', title: 'Software Development Engineer', startDate: '2024-05-01', endDate: '2025-04-01', description: '• Launched the first version of AWSTV with a custom React and VideoJS player.' },
  ],
};
const good = () => ({
  title: 'Staff Design Technologist',
  summary: 'Builds React and TypeScript interfaces, from AI components to a video player.',
  skillsGrouped: { Languages: ['TypeScript'], Frameworks: ['React', 'Node.js'] },
  experience: [
    { company: 'Equinix', title: 'Senior UI Engineer', period: 'May 2025 - Present', description: '• Built reusable AI components for the Fabric port domain.\n• Raised user engagement 25%.' },
    { company: 'Amazon', title: 'Software Development Engineer', period: 'May 2024 - Apr 2025', description: '• Launched AWSTV with a custom React and VideoJS player.' },
  ],
});

test('a faithful result passes every check', () => {
  const r = deterministicChecks({ profile: PROFILE, result: good(), jobDescription: 'Build design systems.' });
  assert.deepEqual(r.failures, []);
});

test('renamed roles, missing dates and foreign employers are caught', () => {
  const bad = good();
  bad.experience[0] = { company: 'Brightline Retail', title: 'Data Analyst', period: '', description: '• Built reports.' };
  const checks = deterministicChecks({ profile: PROFILE, result: bad, jobDescription: '' }).failures.map((f) => f.check);
  assert.ok(checks.includes('role-company'));
  assert.ok(checks.includes('role-title'));
  assert.ok(checks.includes('role-dates'));
});

test('invented numbers, unknown skills and years claims are caught', () => {
  const bad = good();
  bad.summary = 'Engineer with 8+ years who served 1M+ users.';
  bad.skillsGrouped = { Tools: ['Tableau', 'React'] };
  const checks = deterministicChecks({ profile: PROFILE, result: bad, jobDescription: '' }).failures.map((f) => f.check);
  assert.ok(checks.includes('invented-number'));
  assert.ok(checks.includes('summary-years'));
  assert.ok(checks.includes('skill-not-in-profile'));
});

test('a duplicated skill and a copied posting phrase are caught', () => {
  const bad = good();
  bad.skillsGrouped = { Languages: ['React', 'React'] };
  bad.summary = 'Builds scalable design systems and reusable component libraries daily.';
  const checks = deterministicChecks({ profile: PROFILE, result: bad, jobDescription: 'Experience building scalable design systems and reusable component libraries.' }).failures.map((f) => f.check);
  assert.ok(checks.includes('duplicate-skills'));
  assert.ok(checks.includes('summary-copies-jd'));
});

const { atsChecks } = require('./tailorJudge');

test('ats: a supported keyword the resume omits is a miss, an unsupported one is a gap', () => {
  const r = good();
  r._jobKeywords = ['React', 'Node.js', 'Figma'];
  r.skillsGrouped = { Languages: ['TypeScript'], Frameworks: ['React'] }; // Node.js is in the profile, left out here
  const out = atsChecks({ profile: PROFILE, result: r });
  assert.deepEqual(out.missingSupported, ['Node.js']);
  assert.ok(out.gaps.includes('Figma'));
  assert.ok(!out.missingSupported.includes('Figma'));
});

test('ats: unreadable dates, odd characters and placeholders are flagged', () => {
  const r = good();
  r._jobKeywords = [];
  r.experience[0].period = '2025-04-01';
  r.summary = 'Builds React → interfaces [add metric]';
  const problems = atsChecks({ profile: PROFILE, result: r }).problems.join(' | ');
  assert.match(problems, /date not machine-readable/);
  assert.match(problems, /non-ASCII/);
  assert.match(problems, /placeholder/);
});
