import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { buildFixtures, OUT_DIR } from './build-fixtures.mjs';

let buildDownloadPayload;
let resolveResumeTitle;

before(async () => {
  await buildFixtures();
  const mod = await import(resolve(OUT_DIR, 'downloadPayload.mjs'));
  buildDownloadPayload = mod.buildDownloadPayload;
  resolveResumeTitle = mod.resolveResumeTitle;
});

/** A candidate whose standing profile title is a DIFFERENT band to the posting. */
const PROFILE = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  title: 'Senior Software Engineer',
  phone: '555-0100',
  location: 'Remote',
  summary: 'profile summary',
  skills: ['Fortran'],
  experience: [{ company: 'Analytical Engines', title: 'Senior Software Engineer' }],
  education: [{ school: 'Somewhere', degree: 'BSc' }],
  certifications: [{ name: 'Cert' }],
  projects: [{ title: 'Profile project' }],
};

const TAILORED = {
  title: 'Staff Software Engineer',
  jobTitle: 'Staff Software Engineer',
  company: 'Acme Corp',
  summary: 'tailored summary',
  skills: ['Go', 'Kubernetes'],
  skillsGrouped: { Languages: ['Go'], Infrastructure: ['Kubernetes'] },
  experience: [{ company: 'Analytical Engines', title: 'Senior Software Engineer', description: 'tailored bullets' }],
  education: [{ school: 'Somewhere', degree: 'BSc', field: 'Maths' }],
  projects: [{ title: 'Tailored project' }],
  matchScore: 82,
};

// ── The reported bug ────────────────────────────────────────────────────────

test('a resume tailored to a Staff posting is NOT headlined with the profile title', () => {
  // This is the defect the user hit: `profile.title || tailored.title` meant
  // the stored profile title won unconditionally, so every tailored resume was
  // headlined "Senior Software Engineer" no matter which job it was for.
  const payload = buildDownloadPayload(TAILORED, PROFILE);
  assert.equal(payload.title, 'Staff Software Engineer');
  assert.notEqual(payload.title, PROFILE.title);
});

test('the seniority band of the posting survives into the rendered headline', () => {
  const payload = buildDownloadPayload(TAILORED, PROFILE);
  assert.match(payload.title, /^Staff\b/);
});

test('title precedence is tailored title, then scraped job title, then profile', () => {
  assert.equal(
    resolveResumeTitle({ title: 'Staff Engineer', jobTitle: 'Staff Engineer, Platform' }, PROFILE),
    'Staff Engineer'
  );
  // No engine title (e.g. an older cached record) — fall back to the posting's.
  assert.equal(resolveResumeTitle({ jobTitle: 'Staff Engineer, Platform' }, PROFILE), 'Staff Engineer, Platform');
  // Nothing from the posting at all — the candidate's own title is correct.
  assert.equal(resolveResumeTitle({}, PROFILE), 'Senior Software Engineer');
  assert.equal(resolveResumeTitle(null, PROFILE), 'Senior Software Engineer');
  assert.equal(resolveResumeTitle(null, null), '');
});

test('a blank or whitespace tailored title does not blank the headline', () => {
  assert.equal(resolveResumeTitle({ title: '   ' }, PROFILE), 'Senior Software Engineer');
  assert.equal(resolveResumeTitle({ title: '', jobTitle: '  ' }, PROFILE), 'Senior Software Engineer');
});

// ── The other sections that were being discarded ────────────────────────────

test('tailored summary, skills, experience, education and projects all ship', () => {
  const payload = buildDownloadPayload(TAILORED, PROFILE);
  assert.equal(payload.summary, 'tailored summary');
  assert.deepEqual(payload.skills, ['Go', 'Kubernetes']);
  assert.equal(payload.experience[0].description, 'tailored bullets');
  // Previously taken from the profile, discarding the engine's work.
  assert.equal(payload.education[0].field, 'Maths');
  assert.equal(payload.projects[0].title, 'Tailored project');
});

test('the engine’s skill grouping is carried through, not flattened away', () => {
  const payload = buildDownloadPayload(TAILORED, PROFILE);
  assert.deepEqual(payload.skillsGrouped, { Languages: ['Go'], Infrastructure: ['Kubernetes'] });
});

test('an empty projects array is honoured as the user turning projects off', () => {
  // The backend hard-enforces includeProjects=false by emptying the array. If
  // the payload treated empty as "missing" it would resurrect the profile's
  // projects and silently override the user's choice.
  const payload = buildDownloadPayload({ ...TAILORED, projects: [] }, PROFILE);
  assert.deepEqual(payload.projects, []);
});

test('a section the engine did not return falls back to the profile', () => {
  const partial = { title: 'Staff Software Engineer', summary: 'tailored summary' };
  const payload = buildDownloadPayload(partial, PROFILE);
  assert.deepEqual(payload.skills, ['Fortran']);
  assert.deepEqual(payload.education, [{ school: 'Somewhere', degree: 'BSc' }]);
  assert.deepEqual(payload.projects, [{ title: 'Profile project' }]);
});

// ── Contact details are never the engine's to write ─────────────────────────

test('contact details come from the profile only', () => {
  const hostile = {
    ...TAILORED,
    firstName: 'Not',
    lastName: 'Ada',
    email: 'attacker@example.com',
    phone: '000',
    location: 'Elsewhere',
  };
  const payload = buildDownloadPayload(hostile, PROFILE);
  assert.equal(payload.firstName, 'Ada');
  assert.equal(payload.lastName, 'Lovelace');
  assert.equal(payload.email, 'ada@example.com');
  assert.equal(payload.phone, '555-0100');
  assert.equal(payload.location, 'Remote');
});

test('certifications are not a tailored section', () => {
  const payload = buildDownloadPayload(TAILORED, PROFILE);
  assert.deepEqual(payload.certifications, [{ name: 'Cert' }]);
});

test('a null profile does not throw', () => {
  const payload = buildDownloadPayload(TAILORED, null);
  assert.equal(payload.title, 'Staff Software Engineer');
  assert.equal(payload.firstName, '');
  assert.deepEqual(payload.certifications, []);
});
