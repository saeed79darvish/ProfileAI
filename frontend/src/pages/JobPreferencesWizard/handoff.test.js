import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  inferDefaultEmploymentType,
  mapWizardExperienceToEditor,
  wizardEmploymentTypeToEditorValue,
  wizardDataToProfileShape,
} from './handoff.js';
import { computeProfileCompletion } from '../../hooks/useProfileCompletion.js';

test('wizardEmploymentTypeToEditorValue maps every wizard id to the editor label', () => {
  assert.equal(wizardEmploymentTypeToEditorValue('full-time'), 'Full-time');
  assert.equal(wizardEmploymentTypeToEditorValue('part-time'), 'Part-time');
  assert.equal(wizardEmploymentTypeToEditorValue('contract'), 'Contract');
  assert.equal(wizardEmploymentTypeToEditorValue('freelance'), 'Freelance');
  assert.equal(wizardEmploymentTypeToEditorValue('internship'), 'Internship');
});

test('wizardEmploymentTypeToEditorValue returns "" for unknown / empty ids', () => {
  assert.equal(wizardEmploymentTypeToEditorValue(''), '');
  assert.equal(wizardEmploymentTypeToEditorValue(undefined), '');
  assert.equal(wizardEmploymentTypeToEditorValue(null), '');
  assert.equal(wizardEmploymentTypeToEditorValue('contractor'), '');
});

test('inferDefaultEmploymentType prefers Internship for the internship career stage', () => {
  assert.equal(
    inferDefaultEmploymentType({ careerStage: 'internship', employmentTypes: ['contract'] }),
    'Internship',
  );
});

test('inferDefaultEmploymentType falls back to the first selected employmentTypes', () => {
  assert.equal(
    inferDefaultEmploymentType({ employmentTypes: ['part-time', 'contract'] }),
    'Part-time',
  );
});

test('inferDefaultEmploymentType returns "" when nothing is selected', () => {
  assert.equal(inferDefaultEmploymentType({}), '');
  assert.equal(inferDefaultEmploymentType({ employmentTypes: [] }), '');
});

test('mapWizardExperienceToEditor: a currently-working role drives the "Present" sentinel', () => {
  const out = mapWizardExperienceToEditor(
    { title: 'Engineer', company: 'Acme', startDate: '2022-01', endDate: '', current: true },
    { employmentTypes: ['full-time'] },
  );
  // Editor's isPresentValue() reads `endDate === 'Present'` — that's why
  // we store the sentinel string here rather than null/undefined as the
  // original spec suggested. Same behavioural outcome: the editor renders
  // "Present · ongoing role".
  assert.equal(out.endDate, 'Present');
  assert.equal(out.currentlyWorking, true);
  assert.equal(out.employmentType, 'Full-time');
});

test('mapWizardExperienceToEditor: a past role preserves the user-entered endDate', () => {
  const out = mapWizardExperienceToEditor(
    { title: 'Engineer', company: 'Acme', startDate: '2020-01', endDate: '2022-06', current: false },
    { employmentTypes: ['contract'] },
  );
  assert.equal(out.endDate, '2022-06');
  assert.equal(out.currentlyWorking, false);
  assert.equal(out.employmentType, 'Contract');
});

test('mapWizardExperienceToEditor: the checkbox wins over a stale endDate', () => {
  // The wizard disables the End-date input when "I currently work here" is
  // ticked, but the underlying string isn't cleared. The checkbox is the
  // source of truth.
  const out = mapWizardExperienceToEditor(
    { title: 'Engineer', company: 'Acme', startDate: '2022-01', endDate: '2023-12', current: true },
    {},
  );
  assert.equal(out.endDate, 'Present');
  assert.equal(out.currentlyWorking, true);
});

test('mapWizardExperienceToEditor: no opportunity-type selection leaves employmentType blank', () => {
  const out = mapWizardExperienceToEditor(
    { title: 'Engineer', company: 'Acme', current: false },
    {},
  );
  assert.equal(out.employmentType, '');
});

test('mapWizardExperienceToEditor: does not mutate the input row', () => {
  const row = { title: 'Engineer', current: true, endDate: '2023-12' };
  const before = JSON.stringify(row);
  mapWizardExperienceToEditor(row, { employmentTypes: ['full-time'] });
  assert.equal(JSON.stringify(row), before);
});

// ── wizardDataToProfileShape + completion parity ─────────────────────────────

test('wizardDataToProfileShape: synthesises a github URL from a bare username', () => {
  const out = wizardDataToProfileShape({ githubUsername: 'octocat' });
  assert.equal(out.githubUrl, 'https://github.com/octocat');
});

test('wizardDataToProfileShape: empty github yields empty githubUrl (not "https://github.com/")', () => {
  const out = wizardDataToProfileShape({});
  assert.equal(out.githubUrl, '');
});

test('wizardDataToProfileShape: summary and profilePicture come through empty', () => {
  // Wizard doesn't capture these; they belong to the editor. The unified
  // rubric should mark both as not-done, costing the wizard ~22%.
  const out = wizardDataToProfileShape({ title: 'Engineer' });
  assert.equal(out.summary, '');
  assert.equal(out.profilePicture, '');
});

test('completion parity: wizard scoring matches editor scoring for the same logical profile', () => {
  // A user fills in every field the wizard collects. The unified rubric
  // should return the SAME pct/label whether we score the wizard's data
  // or the equivalent editor-shaped profile — that's the fix this phase
  // is shipping.
  const wizardData = {
    title: 'Senior Engineer',
    location: 'Remote',
    sector: 'tech',
    employmentTypes: ['full-time'],
    workSetups: ['remote'],
    skills: ['React', 'TypeScript', 'Node'],
    experience: [{ title: 'Engineer', company: 'Acme', startDate: '2022-01', endDate: 'Present', current: true, description: 'Built things.' }],
    education: [{ degree: 'B.S. CS', institution: 'State U', startDate: '2018', endDate: '2022' }],
    projects: [{ title: 'OpenProj', role: 'Maintainer', description: 'A library that does things.', url: 'https://example.com' }],
    githubUsername: 'octocat',
    portfolioUrl: '',
  };
  const wizardScore = computeProfileCompletion(wizardDataToProfileShape(wizardData));

  // Equivalent editor shape — what the user would have after the handoff.
  const editorProfile = {
    title: 'Senior Engineer',
    location: 'Remote',
    summary: '',
    profilePicture: '',
    skills: { core: ['React', 'TypeScript', 'Node'] },
    experience: [{ title: 'Engineer', company: 'Acme', startDate: '2022-01', endDate: 'Present' }],
    education: [{ degree: 'B.S. CS', institution: 'State U', startDate: '2018', endDate: '2022' }],
    projects: [{ title: 'OpenProj', description: 'A library that does things.' }],
    githubUrl: 'https://github.com/octocat',
    linkedinUrl: '',
    portfolioUrl: '',
  };
  const editorScore = computeProfileCompletion(editorProfile);

  assert.equal(wizardScore.pct, editorScore.pct);
  assert.equal(wizardScore.label, editorScore.label);
  assert.equal(wizardScore.color, editorScore.color);
});

test('completion: a fully-filled wizard maxes out at 7/9 (~78%) — summary + photo are editor-only', () => {
  const wizardData = {
    title: 'Senior Engineer',
    location: 'Remote',
    skills: ['React'],
    experience: [{ title: 'Engineer', company: 'Acme', startDate: '2022-01', endDate: 'Present' }],
    education: [{ degree: 'B.S. CS', institution: 'State U' }],
    projects: [{ title: 'OpenProj', description: 'A library.' }],
    githubUsername: 'octocat',
  };
  const score = computeProfileCompletion(wizardDataToProfileShape(wizardData));
  // 7 of 9 items satisfied: title, location, links, skills, exp, edu, proj.
  // Missing: summary, photo. Rounded: 78%.
  assert.equal(score.score, 7);
  assert.equal(score.total, 9);
  assert.equal(score.pct, 78);
  assert.equal(score.label, 'Intermediate');
});

test('completion: an empty wizard scores 0% / Beginner', () => {
  const score = computeProfileCompletion(wizardDataToProfileShape({}));
  assert.equal(score.pct, 0);
  assert.equal(score.label, 'Beginner');
});

// ── Phase 1.5: clicking "Add education/role/project" must not move the meter ─
// Mirrors the EMPTY_* templates declared in JobPreferencesWizard/index.jsx.
// If those templates ever drift, the parity-via-adapter assertions still hold
// as long as the wizard inserts empty-string fields (the user-visible
// invariant).

const WIZARD_EMPTY_EDUCATION = { degree: '', fieldOfStudy: '', institution: '', startDate: '', endDate: '' };
const WIZARD_EMPTY_EXPERIENCE = { title: '', company: '', startDate: '', endDate: '', current: false, description: '' };
const WIZARD_EMPTY_PROJECT = { title: '', role: '', description: '', url: '' };

test('wizard parity: addRow("education", EMPTY_EDUCATION) leaves the meter unchanged', () => {
  const base = { title: 'Engineer', location: 'Remote', skills: ['React'] };
  const before = computeProfileCompletion(wizardDataToProfileShape(base));
  const afterClick = computeProfileCompletion(
    wizardDataToProfileShape({ ...base, education: [WIZARD_EMPTY_EDUCATION] }),
  );
  assert.equal(afterClick.pct, before.pct);
});

test('wizard parity: addRow("experience", EMPTY_EXPERIENCE) leaves the meter unchanged', () => {
  const base = { title: 'Engineer', location: 'Remote', skills: ['React'] };
  const before = computeProfileCompletion(wizardDataToProfileShape(base));
  const afterClick = computeProfileCompletion(
    wizardDataToProfileShape({ ...base, experience: [WIZARD_EMPTY_EXPERIENCE] }),
  );
  assert.equal(afterClick.pct, before.pct);
});

test('wizard parity: addRow("projects", EMPTY_PROJECT) leaves the meter unchanged', () => {
  const base = { title: 'Engineer', location: 'Remote', skills: ['React'] };
  const before = computeProfileCompletion(wizardDataToProfileShape(base));
  const afterClick = computeProfileCompletion(
    wizardDataToProfileShape({ ...base, projects: [WIZARD_EMPTY_PROJECT] }),
  );
  assert.equal(afterClick.pct, before.pct);
});
