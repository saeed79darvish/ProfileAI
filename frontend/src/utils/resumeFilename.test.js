import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildResumeFilename, RESUME_FILENAME_MAX } from './resumeFilename.js';

test('role stops at the first comma; acronyms and front-end read correctly', () => {
  assert.equal(
    buildResumeFilename('Saeed Darvish', 'Staff Front-end UI Architect, Full-Stack'),
    'SaeedDarvish-StaffFrontendUIArchitect',
  );
});

test('no random descriptor or seniority tail', () => {
  const a = buildResumeFilename('Saeed Darvish', 'Senior Frontend Engineer');
  const b = buildResumeFilename('Saeed Darvish', 'Senior Frontend Engineer');
  assert.equal(a, 'SaeedDarvish-SeniorFrontendEngineer');
  assert.equal(a, b);
});

test('long roles drop leading words to fit, keeping the job', () => {
  const out = buildResumeFilename('Alexandra Montgomery', 'Principal Distinguished Software Engineering Manager');
  assert.ok(out.length <= RESUME_FILENAME_MAX, out);
  assert.equal(out, 'AlexandraMontgomery-EngineeringManager');
});

test('full-stack and lowercase input', () => {
  assert.equal(buildResumeFilename('jane doe', 'full-stack developer'), 'JaneDoe-FullStackDeveloper');
});

test('accented names are kept', () => {
  assert.equal(buildResumeFilename('José Núñez', 'Data Engineer'), 'JoséNúñez-DataEngineer');
});

test('missing pieces fall back', () => {
  assert.equal(buildResumeFilename('', ''), 'Candidate-Resume');
  assert.equal(buildResumeFilename('Sam Lee', 'Sr. Engineer (Contract)'), 'SamLee-SrEngineer');
});
