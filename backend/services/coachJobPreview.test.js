const test = require('node:test');
const assert = require('node:assert/strict');

const { pickPreviewJobs, previewProfile, roleQueries, PREVIEW_COUNT } = require('./coachJobPreview');

const job = (id, title, extra = {}) => ({
  id, title, company: `Co ${id}`, location: 'San Francisco, CA', locationType: 'onsite',
  description: '', skills: [], effectivePostedAt: new Date('2026-10-20'), ...extra,
});

const frontendProfile = (extra = {}) => previewProfile({
  title: 'Senior Frontend Engineer',
  target: 'Staff Frontend Engineer',
  location: 'San Francisco, CA',
  skills: ['React', 'TypeScript', 'GraphQL'],
  ...extra,
});

test('the best few by fit, with their own skills and no score', () => {
  const pool = [
    job(1, 'Frontend Engineer', { description: 'PHP and jQuery.' }),
    job(2, 'Staff Frontend Engineer', { description: 'React, TypeScript and GraphQL.', skills: ['react', 'typescript', 'graphql'] }),
    job(3, 'Frontend Engineer', { description: 'React.' }),
    job(4, 'Frontend Engineer'),
  ];
  const picked = pickPreviewJobs(pool, frontendProfile());
  assert.equal(picked.length, PREVIEW_COUNT);
  assert.equal(picked[0].id, 2);
  // In the person's own spelling, not the scorer's lowercase.
  assert.deepEqual(picked[0].skills, ['React', 'TypeScript', 'GraphQL']);
  for (const j of picked) {
    assert.equal(j.score, undefined);
    assert.equal(j.relevanceScore, undefined);
  }
});

test('their city or remote before anywhere else', () => {
  const pool = [
    job(1, 'Staff Frontend Engineer', { location: 'Warsaw', description: 'React TypeScript GraphQL' }),
    job(2, 'Frontend Engineer', { location: 'San Francisco, CA' }),
    job(3, 'Frontend Engineer', { location: '', locationType: 'remote' }),
    job(4, 'Frontend Engineer', { location: 'Berlin' }),
  ];
  const picked = pickPreviewJobs(pool, frontendProfile());
  assert.deepEqual(picked.slice(0, 2).map((j) => j.id).sort(), [2, 3]);
  assert.equal(picked.find((j) => j.id === 3).location, 'Remote');
});

test('a senior person is not shown early-career roles', () => {
  const pool = [
    job(1, 'Software Engineer, Frontend (Early Career)'),
    job(2, 'Frontend Engineering Intern'),
    job(3, 'Frontend Engineer'),
    job(4, 'Senior Frontend Engineer'),
    job(5, 'Staff Frontend Engineer'),
  ];
  const picked = pickPreviewJobs(pool, frontendProfile({ constraints: { seniority: 'senior' } }));
  assert.deepEqual(picked.map((j) => j.id).sort(), [3, 4, 5]);
});

test('one opening per company', () => {
  const pool = [1, 2, 3, 4].map((id) => job(id, 'Frontend Engineer', { company: id < 4 ? 'Acme' : 'Globex' }));
  const picked = pickPreviewJobs(pool, previewProfile({ title: 'Frontend Engineer' }));
  assert.deepEqual(picked.map((j) => j.company).sort(), ['Acme', 'Globex']);
});

test('searches come from the target, the title and the roles they held', () => {
  const queries = roleQueries(previewProfile({
    target: 'Staff Software Engineer, AI and LLM Platform',
    title: 'Senior UI Software Architect Engineer',
    experience: [
      { title: 'Lead UI Software Development Engineer, AWSTV' },
      { title: 'Senior UI Engineer (TypeScript, React, Node, GraphQL)' },
      { title: 'Front-End Developer' },
    ],
  }));
  assert.deepEqual(queries, ['Software Engineer', 'UI Engineer', 'UI Development Engineer', 'Frontend Developer']);
});

test('an unauthenticated body is cut to profile-sized pieces', () => {
  const profile = previewProfile({
    title: 'x'.repeat(5000),
    skills: Array.from({ length: 500 }, (_, i) => `s${i}`),
    experience: Array.from({ length: 50 }, () => ({ title: 'Dev', description: 'y'.repeat(9000) })),
    constraints: { seniority: 'senior', junk: 'dropped' },
    junk: 'ignored',
  });
  assert.equal(profile.title.length, 200);
  assert.equal(profile.skills.length, 80);
  assert.equal(profile.experience.length, 12);
  assert.equal(profile.experience[0].description.length, 2000);
  assert.deepEqual(profile.constraints, { seniority: 'senior' });
  assert.equal(profile.junk, undefined);
});

test('a body that is not the right shape is an empty profile, not a crash', () => {
  const profile = previewProfile({ skills: 'React', experience: { title: 'Dev' }, constraints: 'senior' });
  assert.deepEqual(profile.skills, []);
  assert.deepEqual(profile.experience, []);
  assert.deepEqual(profile.constraints, {});
});
