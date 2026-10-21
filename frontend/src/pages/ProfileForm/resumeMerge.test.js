import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeText,
  isEmptyValue,
  hasMeaningfulContent,
  mergeSkills,
  mergeRows,
  ROW_SECTIONS,
  mergeResumeIntoForm,
  replaceFormWithResume,
  diffResumeAgainstForm,
} from './resumeMerge.js';

const emptySkills = () => ({ core: [], technical: [], software: [], industry: [], soft: [] });

const blankForm = () => ({
  title: '',
  location: '',
  phone: '',
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  summary: '',
  profilePicture: '',
  skills: emptySkills(),
  experience: [],
  education: [],
  projects: [],
  isPublic: true,
});

const expKey = ROW_SECTIONS.find((s) => s.key === 'experience').rowKey;

test('normalizeText ignores case, punctuation and spacing', () => {
  assert.equal(normalizeText('  Acme, Inc. '), 'acme inc');
  assert.equal(normalizeText(null), '');
});

test('isEmptyValue treats false as an answer, blanks as empty', () => {
  assert.equal(isEmptyValue(''), true);
  assert.equal(isEmptyValue('   '), true);
  assert.equal(isEmptyValue([]), true);
  assert.equal(isEmptyValue(undefined), true);
  assert.equal(isEmptyValue(false), false);
  assert.equal(isEmptyValue('x'), false);
});

test('hasMeaningfulContent: contact details alone are not content', () => {
  assert.equal(hasMeaningfulContent(blankForm()), false);
  assert.equal(hasMeaningfulContent({ ...blankForm(), phone: '555' }), false);
  assert.equal(hasMeaningfulContent({ ...blankForm(), title: 'Nurse' }), true);
  assert.equal(hasMeaningfulContent({ ...blankForm(), skills: { ...emptySkills(), soft: ['Empathy'] } }), true);
  assert.equal(hasMeaningfulContent({ ...blankForm(), projects: [{ title: 'X' }] }), true);
});

test('mergeSkills unions per category and dedupes case-insensitively across categories', () => {
  const mine = { ...emptySkills(), core: ['React'], soft: ['Leadership'] };
  const parsed = { ...emptySkills(), technical: ['react', 'Node.js'], soft: ['leadership', 'Mentoring'] };
  const { skills, added } = mergeSkills(mine, parsed);
  assert.deepEqual(skills.core, ['React']);
  assert.deepEqual(skills.technical, ['Node.js']);
  assert.deepEqual(skills.soft, ['Leadership', 'Mentoring']);
  assert.equal(added, 2);
});

test('mergeRows keeps existing rows, fills only their empty fields, appends new ones', () => {
  const mine = [{ company: 'Acme', title: 'Engineer', description: 'I wrote this', location: '' }];
  const parsed = [
    { company: 'ACME', title: 'engineer', description: 'Parsed text', location: 'Austin' },
    { company: 'Globex', title: 'Intern', description: 'New role' },
  ];
  const { rows, added, matched } = mergeRows(mine, parsed, expKey);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].description, 'I wrote this');
  assert.equal(rows[0].location, 'Austin');
  assert.equal(rows[1].company, 'Globex');
  assert.equal(added, 1);
  assert.equal(matched, 1);
});

test('mergeRows: same company with a different title is a different role', () => {
  const { rows } = mergeRows([{ company: 'Acme', title: 'Engineer' }], [{ company: 'Acme', title: 'Senior Engineer' }], expKey);
  assert.equal(rows.length, 2);
});

test('mergeResumeIntoForm keeps typed scalars and fills empty ones', () => {
  const form = { ...blankForm(), title: 'Product Designer', summary: '' };
  const parsed = { ...blankForm(), title: 'UX Designer', summary: 'Parsed summary', location: 'Berlin' };
  const next = mergeResumeIntoForm(form, parsed);
  assert.equal(next.title, 'Product Designer');
  assert.equal(next.summary, 'Parsed summary');
  assert.equal(next.location, 'Berlin');
});

test('mergeResumeIntoForm matches education on institution and projects on title', () => {
  const form = {
    ...blankForm(),
    education: [{ institution: 'MIT', degree: '' }],
    projects: [{ title: 'Portfolio Site', description: 'mine' }],
  };
  const parsed = {
    ...blankForm(),
    education: [{ institution: 'mit', degree: 'BSc' }, { institution: 'Stanford', degree: 'MSc' }],
    projects: [{ title: 'portfolio site', description: 'theirs' }],
  };
  const next = mergeResumeIntoForm(form, parsed);
  assert.equal(next.education.length, 2);
  assert.equal(next.education[0].degree, 'BSc');
  assert.equal(next.projects.length, 1);
  assert.equal(next.projects[0].description, 'mine');
});

test('replaceFormWithResume never wipes skills or rows with an empty parse', () => {
  const form = {
    ...blankForm(),
    title: 'Mine',
    skills: { ...emptySkills(), core: ['Excel'] },
    experience: [{ company: 'Acme', title: 'Analyst' }],
  };
  const next = replaceFormWithResume(form, { ...blankForm(), title: 'Theirs' });
  assert.equal(next.title, 'Theirs');
  assert.deepEqual(next.skills.core, ['Excel']);
  assert.equal(next.experience.length, 1);
});

test('replaceFormWithResume replaces sections the resume has', () => {
  const form = { ...blankForm(), skills: { ...emptySkills(), core: ['Excel'] }, experience: [{ company: 'A' }] };
  const parsed = { ...blankForm(), skills: { ...emptySkills(), technical: ['SQL'] }, experience: [{ company: 'B' }] };
  const next = replaceFormWithResume(form, parsed);
  assert.deepEqual(next.skills.core, []);
  assert.deepEqual(next.skills.technical, ['SQL']);
  assert.deepEqual(next.experience, [{ company: 'B' }]);
});

test('diffResumeAgainstForm lists per-section differences in plain lines', () => {
  const form = {
    ...blankForm(),
    title: 'X',
    skills: { ...emptySkills(), core: ['React'] },
    experience: [{ company: 'Acme', title: 'Engineer' }],
  };
  const parsed = {
    ...blankForm(),
    title: 'Y',
    summary: 'Hello',
    skills: { ...emptySkills(), core: ['react', 'Go'] },
    experience: [{ company: 'Acme', title: 'Engineer' }, { company: 'Globex', title: 'Intern' }],
  };
  const lines = diffResumeAgainstForm(form, parsed).map((e) => e.text);
  assert.ok(lines.includes('Title: yours "X" / from resume "Y"'));
  assert.ok(lines.includes('Summary: empty now / from resume "Hello"'));
  assert.ok(lines.includes('Skills: 2 from resume, 1 you have; 1 new'));
  assert.ok(lines.includes('Experience: 2 roles from resume, 1 you have; 1 matches'));
});

test('diffResumeAgainstForm skips scalars that already agree and sections the resume lacks', () => {
  const form = { ...blankForm(), title: 'Nurse', projects: [{ title: 'P' }] };
  const parsed = { ...blankForm(), title: 'nurse' };
  assert.deepEqual(diffResumeAgainstForm(form, parsed), []);
});
