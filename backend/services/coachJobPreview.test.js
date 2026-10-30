const test = require('node:test');
const assert = require('node:assert/strict');

const { pickPreviewJobs, previewProfile, termSets, PREVIEW_COUNT } = require('./coachJobPreview');

const job = (id, title, extra = {}) => ({
  id, title, company: `Co ${id}`, location: 'San Francisco, CA', locationType: 'onsite',
  description: '', skills: [], effectivePostedAt: new Date('2026-10-20'), ...extra,
});

test('the best few by fit, with no score on them', () => {
  const profile = previewProfile({
    title: 'Senior Frontend Engineer',
    target: 'Staff Frontend Engineer',
    location: 'San Francisco, CA',
    skills: ['React', 'TypeScript', 'GraphQL'],
  });
  const pool = [
    job(1, 'Frontend Engineer', { description: 'PHP and jQuery.' }),
    job(2, 'Staff Frontend Engineer', { description: 'React, TypeScript and GraphQL.', skills: ['react', 'typescript', 'graphql'] }),
    job(3, 'Frontend Engineer', { description: 'React.' }),
    job(4, 'Frontend Engineer'),
  ];
  const picked = pickPreviewJobs(pool, profile);
  assert.equal(picked.length, PREVIEW_COUNT);
  assert.equal(picked[0].id, 2);
  for (const j of picked) {
    assert.deepEqual(Object.keys(j).sort(), ['company', 'id', 'location', 'postedAt', 'title']);
  }
});

test('a remote posting with no place says Remote', () => {
  const [picked] = pickPreviewJobs([job(1, 'Frontend Engineer', { location: '', locationType: 'remote' })], previewProfile({ title: 'Frontend Engineer' }));
  assert.equal(picked.location, 'Remote');
});

test('an unauthenticated body is cut to profile-sized pieces', () => {
  const profile = previewProfile({
    title: 'x'.repeat(5000),
    skills: Array.from({ length: 500 }, (_, i) => `s${i}`),
    experience: Array.from({ length: 50 }, () => ({ title: 'Dev', description: 'y'.repeat(9000) })),
    junk: 'ignored',
  });
  assert.equal(profile.title.length, 200);
  assert.equal(profile.skills.length, 80);
  assert.equal(profile.experience.length, 12);
  assert.equal(profile.experience[0].description.length, 2000);
  assert.equal(profile.junk, undefined);
});

test('a body that is not the right shape is an empty profile, not a crash', () => {
  const profile = previewProfile({ skills: 'React', experience: { title: 'Dev' } });
  assert.deepEqual(profile.skills, []);
  assert.deepEqual(profile.experience, []);
});

test('the title net widens from the target to their current title', () => {
  const sets = termSets(previewProfile({
    title: 'Senior Frontend Engineer',
    target: 'Staff Software Engineer, AI and LLM Platform',
  }));
  assert.deepEqual(sets, [
    ['software', 'engineer', 'llm'],
    ['software', 'engineer'],
    ['frontend', 'engineer'],
  ]);
});

test('no title words to match on, no query', () => {
  assert.deepEqual(termSets(previewProfile({ title: 'Manager' })), []);
});

test('one opening per company', () => {
  const pool = [1, 2, 3, 4].map((id) => job(id, 'Frontend Engineer', { company: id < 4 ? 'Acme' : 'Globex' }));
  const picked = pickPreviewJobs(pool, previewProfile({ title: 'Frontend Engineer' }));
  assert.deepEqual(picked.map((j) => j.company).sort(), ['Acme', 'Globex']);
});
