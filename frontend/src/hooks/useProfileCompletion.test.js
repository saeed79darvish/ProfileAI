import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COMPLETION_RUBRIC,
  COMPLETION_TIERS,
  computeProfileCompletion,
} from './useProfileCompletion.js';

// ── Rubric integrity ─────────────────────────────────────────────────────────

test('COMPLETION_RUBRIC: has 9 items', () => {
  assert.equal(COMPLETION_RUBRIC.length, 9);
});

test('COMPLETION_RUBRIC: every key is unique', () => {
  const keys = COMPLETION_RUBRIC.map((r) => r.key);
  assert.equal(keys.length, new Set(keys).size);
});

test('COMPLETION_TIERS: thresholds are descending', () => {
  for (let i = 1; i < COMPLETION_TIERS.length; i++) {
    assert.ok(COMPLETION_TIERS[i - 1].min > COMPLETION_TIERS[i].min);
  }
});

// ── computeProfileCompletion: shape and edge cases ───────────────────────────

test('computeProfileCompletion: empty profile is 0% / Beginner', () => {
  const out = computeProfileCompletion({});
  assert.equal(out.pct, 0);
  assert.equal(out.label, 'Beginner');
  assert.equal(out.color, '#94a3b8');
  assert.equal(out.score, 0);
  // 9 rubric items minus photo (optional). Neither experience nor projects
  // exist yet, so both still apply.
  assert.equal(out.total, 8);
  assert.equal(out.done, false);
  assert.equal(out.missing.length, 8);
});

test('computeProfileCompletion: 100% / Advanced when every item is satisfied', () => {
  const profile = {
    title: 'Senior Engineer',
    summary: 'Twenty characters at least to pass.',
    location: 'Remote',
    profilePicture: 'https://example.com/me.jpg',
    linkedinUrl: 'https://linkedin.com/in/me',
    githubUrl: 'https://github.com/me',
    skills: ['React'],
    experience: [{ title: 'Eng', company: 'Acme', startDate: '2020' }],
    education: [{ institution: 'State U', degree: 'B.S.' }],
    projects: [{ title: 'OpenProj', description: 'Does things.' }],
  };
  const out = computeProfileCompletion(profile);
  assert.equal(out.pct, 100);
  assert.equal(out.label, 'Advanced');
  assert.equal(out.color, '#16a34a');
  assert.equal(out.done, true);
  assert.equal(out.missing.length, 0);
});

test('computeProfileCompletion: tier boundaries', () => {
  // With experience, 7 items count: title, summary, location, links, skills,
  // exp, edu (photo is optional; projects do not apply).
  //   Score 3/7 = 43% Beginner
  //   Score 4/7 = 57% Intermediate
  //   Score 5/7 = 71% Intermediate
  //   Score 6/7 = 86% Advanced
  const baseThree = {
    title: 'X',
    skills: ['React'],
    experience: [{ title: 'E', company: 'A', startDate: '2020' }],
  };
  const threeOut = computeProfileCompletion(baseThree);
  assert.equal(threeOut.total, 7);
  assert.equal(threeOut.score, 3);
  assert.equal(threeOut.label, 'Beginner');

  const fourOut = computeProfileCompletion({ ...baseThree, location: 'Y' });
  assert.equal(fourOut.score, 4);
  assert.equal(fourOut.label, 'Intermediate');

  const fiveOut = computeProfileCompletion({
    ...baseThree,
    location: 'Y',
    education: [{ institution: 'S', degree: 'B' }],
  });
  assert.equal(fiveOut.score, 5);
  assert.equal(fiveOut.label, 'Intermediate');

  const sixOut = computeProfileCompletion({
    ...baseThree,
    location: 'Y',
    education: [{ institution: 'S', degree: 'B' }],
    linkedinUrl: 'https://linkedin.com/in/me',
  });
  assert.equal(sixOut.score, 6);
  assert.equal(sixOut.label, 'Advanced');
});

// ── Applicability: one score everywhere ──────────────────────────────────────

test('applicability: photo is optional, never counted, still reported', () => {
  const without = computeProfileCompletion({ title: 'X' });
  const withPhoto = computeProfileCompletion({ title: 'X', profilePicture: 'https://example.com/me.jpg' });
  assert.equal(withPhoto.pct, without.pct);
  assert.equal(without.items.find((i) => i.key === 'photo'), undefined);
  assert.equal(without.optional.find((i) => i.key === 'photo').done, false);
  assert.equal(withPhoto.optional.find((i) => i.key === 'photo').done, true);
});

test('applicability: projects do not count when experience exists', () => {
  const out = computeProfileCompletion({
    experience: [{ title: 'Eng', company: 'Acme', startDate: '2020' }],
  });
  assert.equal(out.items.find((i) => i.key === 'proj'), undefined);
  assert.ok(out.items.find((i) => i.key === 'exp'));
});

test('applicability: experience does not count when only projects exist', () => {
  const out = computeProfileCompletion({
    projects: [{ title: 'OpenProj', description: 'Does things.' }],
  });
  assert.equal(out.items.find((i) => i.key === 'exp'), undefined);
  assert.equal(out.items.find((i) => i.key === 'proj').done, true);
});

test('applicability: a full profile with a job scores 100% with no projects and no photo', () => {
  const out = computeProfileCompletion({
    title: 'Senior Engineer',
    summary: 'Twenty characters at least to pass.',
    location: 'Remote',
    linkedinUrl: 'https://linkedin.com/in/me',
    skills: ['React'],
    experience: [{ title: 'Eng', company: 'Acme', startDate: '2020' }],
    education: [{ institution: 'State U', degree: 'B.S.' }],
  });
  assert.equal(out.pct, 100);
  assert.equal(out.done, true);
});

test('applicability: shape stays { pct, label, color, items }', () => {
  const out = computeProfileCompletion({ title: 'X' });
  for (const key of ['pct', 'label', 'color', 'items']) assert.ok(key in out, key);
  assert.ok(Array.isArray(out.items));
});

test('computeProfileCompletion: summary needs ≥20 characters', () => {
  const short = computeProfileCompletion({ title: 'X', summary: 'too short' });
  const long = computeProfileCompletion({ title: 'X', summary: 'this one is over twenty characters' });
  assert.equal(short.items.find((i) => i.key === 'summary').done, false);
  assert.equal(long.items.find((i) => i.key === 'summary').done, true);
});

test('computeProfileCompletion: experience needs company + title + a date', () => {
  // Missing date → not counted
  const noDate = computeProfileCompletion({
    experience: [{ title: 'Eng', company: 'Acme' }],
  });
  assert.equal(noDate.items.find((i) => i.key === 'exp').done, false);
  // Date supplied → counted
  const withDate = computeProfileCompletion({
    experience: [{ title: 'Eng', company: 'Acme', startDate: '2020' }],
  });
  assert.equal(withDate.items.find((i) => i.key === 'exp').done, true);
});

test('computeProfileCompletion: skills accepts both a keyed object and a flat array', () => {
  const flat = computeProfileCompletion({ skills: ['React'] });
  const keyed = computeProfileCompletion({ skills: { core: ['React'], soft: [] } });
  assert.equal(flat.items.find((i) => i.key === 'skills').done, true);
  assert.equal(keyed.items.find((i) => i.key === 'skills').done, true);
});

test('computeProfileCompletion: rejects placeholder strings as not-real values', () => {
  // The PLACEHOLDER_RE list catches stub data that AI / resume parsers
  // sometimes emit. These shouldn't count toward completion.
  const out = computeProfileCompletion({
    title: 'title',                                  // placeholder, not real
    education: [{ institution: 'institution name', degree: 'degree' }],
  });
  assert.equal(out.items.find((i) => i.key === 'title').done, false);
  assert.equal(out.items.find((i) => i.key === 'edu').done, false);
});

// ── Phase 1.5: empty sections must not inflate the score ─────────────────────
// Regression test for the wizard bug where clicking "Add education" with no
// input jumped the meter to 86%. Locks the invariant that array length is
// never the signal — only the presence of real values inside the entry is.

const EMPTY_EDUCATION = { degree: '', fieldOfStudy: '', institution: '', startDate: '', endDate: '' };
const EMPTY_EXPERIENCE = { title: '', company: '', startDate: '', endDate: '', current: false, description: '' };
const EMPTY_PROJECT = { title: '', role: '', description: '', url: '' };

test('empty section: adding an empty education entry does NOT change the score', () => {
  const base = { title: 'Engineer', location: 'Remote' };
  const before = computeProfileCompletion(base);
  const after = computeProfileCompletion({ ...base, education: [EMPTY_EDUCATION] });
  assert.equal(after.score, before.score);
  assert.equal(after.pct, before.pct);
  assert.equal(after.items.find((i) => i.key === 'edu').done, false);
});

test('empty section: adding an empty experience entry does NOT change the score', () => {
  const base = { title: 'Engineer', location: 'Remote' };
  const before = computeProfileCompletion(base);
  const after = computeProfileCompletion({ ...base, experience: [EMPTY_EXPERIENCE] });
  assert.equal(after.score, before.score);
  assert.equal(after.pct, before.pct);
  assert.equal(after.items.find((i) => i.key === 'exp').done, false);
});

test('empty section: adding an empty project entry does NOT change the score', () => {
  const base = { title: 'Engineer', location: 'Remote' };
  const before = computeProfileCompletion(base);
  const after = computeProfileCompletion({ ...base, projects: [EMPTY_PROJECT] });
  assert.equal(after.score, before.score);
  assert.equal(after.pct, before.pct);
  assert.equal(after.items.find((i) => i.key === 'proj').done, false);
});

test('empty section: filling a previously-empty education entry DOES increase the score', () => {
  const empty = { title: 'Engineer', location: 'Remote', education: [EMPTY_EDUCATION] };
  const filled = {
    title: 'Engineer',
    location: 'Remote',
    education: [{ ...EMPTY_EDUCATION, institution: 'State U', degree: 'B.S. CS' }],
  };
  const emptyScore = computeProfileCompletion(empty);
  const filledScore = computeProfileCompletion(filled);
  // Exactly one new checklist item ticks → ~11% bump.
  assert.equal(filledScore.score - emptyScore.score, 1);
  assert.ok(filledScore.pct > emptyScore.pct);
  assert.equal(filledScore.items.find((i) => i.key === 'edu').done, true);
});

test('empty section: whitespace-only entries are treated as empty', () => {
  const base = { title: 'Engineer' };
  const before = computeProfileCompletion(base);
  const withWhitespace = {
    ...base,
    education: [{ institution: '   ', degree: '\t' }],
    experience: [{ company: ' ', title: '  ', startDate: '   ' }],
    projects: [{ title: '   ', description: '\n' }],
  };
  const after = computeProfileCompletion(withWhitespace);
  assert.equal(after.score, before.score);
  assert.equal(after.pct, before.pct);
});

test('empty section: partial entries (one required field missing) do NOT count', () => {
  // Education with institution but no degree → not done.
  const eduOnlyInstitution = computeProfileCompletion({
    education: [{ institution: 'State U', degree: '' }],
  });
  assert.equal(eduOnlyInstitution.items.find((i) => i.key === 'edu').done, false);

  // Experience with company + title but no date → not done.
  const expNoDate = computeProfileCompletion({
    experience: [{ company: 'Acme', title: 'Eng' }],
  });
  assert.equal(expNoDate.items.find((i) => i.key === 'exp').done, false);

  // Project with title but no description → not done.
  const projNoDesc = computeProfileCompletion({
    projects: [{ title: 'OpenProj', description: '' }],
  });
  assert.equal(projNoDesc.items.find((i) => i.key === 'proj').done, false);
});

test('empty section: multiple empty entries also do not inflate the score', () => {
  // Even five empty rows should not move the needle — the bug originally
  // was triggered by a single click, but this guards against the
  // possibility of a "Add several rows" affordance later.
  const base = { title: 'Engineer' };
  const before = computeProfileCompletion(base);
  const after = computeProfileCompletion({
    ...base,
    education: Array(5).fill(EMPTY_EDUCATION),
    experience: Array(5).fill(EMPTY_EXPERIENCE),
    projects: Array(5).fill(EMPTY_PROJECT),
  });
  assert.equal(after.score, before.score);
  assert.equal(after.pct, before.pct);
});
