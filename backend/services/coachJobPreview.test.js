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

test('their metro, then remote they can take, then their country, never abroad', () => {
  // The card that prompted this: El Segundo on top, Warsaw and a "remote"
  // Budapest posting below, for someone in San Francisco.
  const pool = [
    job(1, 'Staff Frontend Engineer', { location: 'El Segundo, California, United States', description: 'React TypeScript GraphQL' }),
    job(2, 'Staff Frontend Engineer', { location: 'Warsaw', description: 'React TypeScript GraphQL' }),
    job(3, 'Staff Frontend Engineer', { location: 'Budapest, Hungary', locationType: 'remote', description: 'React TypeScript GraphQL' }),
    job(4, 'Frontend Engineer', { location: 'San Mateo, CA' }),
    job(5, 'Frontend Engineer', { location: 'Remote - United States', locationType: 'remote' }),
  ];
  const picked = pickPreviewJobs(pool, frontendProfile());
  assert.deepEqual(picked.map((j) => j.id), [4, 5, 1]);
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

test('one opening per company even when the name is spelled two ways', () => {
  // Production showed "Coupang" and "Coupang Internal", and "Atoms" and
  // "ATOMS Careers page", as separate employers on one card.
  const pool = [
    job(1, 'Data Analyst', { company: 'Coupang' }),
    job(2, 'Data Analyst', { company: 'Coupang Internal' }),
    job(3, 'Data Analyst', { company: 'Atoms' }),
    job(4, 'Data Analyst', { company: 'ATOMS Careers page' }),
    job(5, 'Data Analyst', { company: 'Globex' }),
  ];
  const picked = pickPreviewJobs(pool, previewProfile({ title: 'Data Analyst' }));
  assert.equal(picked.length, PREVIEW_COUNT);
  assert.deepEqual(new Set(picked.map((j) => j.company.toLowerCase().split(' ')[0])).size, PREVIEW_COUNT);
});

test('a senior person is not shown staff-level roles while others remain', () => {
  // A senior data analyst was shown two "Staff Data Analyst" postings.
  const pool = [
    ...[1, 2, 3, 4, 5, 6].map((id) => job(id, 'Senior Data Analyst')),
    job(7, 'Staff Data Analyst', { description: 'SQL Python Tableau', skills: ['sql', 'python', 'tableau'] }),
    job(8, 'Principal Data Analyst', { description: 'SQL Python Tableau', skills: ['sql', 'python', 'tableau'] }),
  ];
  const profile = previewProfile({
    title: 'Data Analyst', target: 'Senior Data Analyst', location: 'San Francisco, CA',
    skills: ['SQL', 'Python', 'Tableau'], constraints: { seniority: 'senior' },
  });
  const picked = pickPreviewJobs(pool, profile);
  assert.equal(picked.length, PREVIEW_COUNT);
  assert.ok(picked.every((j) => ![7, 8].includes(j.id)), 'no staff or principal on the card');
});

test('staff roles stay when the senior person is heading for one, or little else exists', () => {
  const staffPool = [
    ...[1, 2, 3, 4, 5, 6].map((id) => job(id, 'Senior Data Analyst')),
    job(7, 'Staff Data Analyst', { description: 'SQL Python Tableau', skills: ['sql', 'python', 'tableau'] }),
  ];
  const aiming = previewProfile({
    title: 'Senior Data Analyst', target: 'Staff Data Analyst', location: 'San Francisco, CA',
    skills: ['SQL', 'Python', 'Tableau'], constraints: { seniority: 'senior' },
  });
  assert.ok(pickPreviewJobs(staffPool, aiming).some((j) => j.id === 7), 'their own target is kept');

  // Too few other roles: better a staff role than a thin card.
  const thin = [job(1, 'Senior Data Analyst'), job(2, 'Staff Data Analyst'), job(3, 'Principal Data Analyst')];
  const picked = pickPreviewJobs(thin, previewProfile({
    title: 'Data Analyst', target: 'Senior Data Analyst', location: 'San Francisco, CA',
    constraints: { seniority: 'senior' },
  }));
  assert.equal(picked.length, PREVIEW_COUNT);
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
  // A target written as a sentence is searched as its role.
  assert.deepEqual(roleQueries(previewProfile({
    target: 'Staff Software Engineer focused on frontend and backend, fitting an AI engineering team',
  })), ['Software Engineer']);
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
