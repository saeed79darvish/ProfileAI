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
