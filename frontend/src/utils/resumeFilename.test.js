import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildResumeFilename, uniqueResumeName, RESUME_FILENAME_MAX } from './resumeFilename.js';

test('name, role and company, hyphen separated', () => {
  assert.equal(
    buildResumeFilename('Saeed Darvish', 'Software Engineer', 'Google'),
    'Saeed-Darvish-Software-Engineer-Google',
  );
});

test('the role stops at the first comma or dash; front-end and acronyms read correctly', () => {
  assert.equal(
    buildResumeFilename('Saeed Darvish', 'Staff Front-end UI Architect, Full-Stack', 'Acme Inc.'),
    'Saeed-Darvish-Frontend-UI-Architect-Acme',
  );
  assert.equal(
    buildResumeFilename('Saeed Darvish', 'Sr. Software Engineer - Full Stack', 'Illumio'),
    'Saeed-Darvish-Software-Engineer-Illumio',
  );
});

test('long roles drop leading words to fit, keeping the job', () => {
  const out = buildResumeFilename('Alexandra Montgomery', 'Principal Distinguished Software Engineering Manager', 'Stripe');
  assert.ok(out.length <= RESUME_FILENAME_MAX, out);
  assert.ok(out.endsWith('-Manager-Stripe'), out);
});

test('company suffixes are dropped and no company still works', () => {
  assert.equal(buildResumeFilename('jane doe', 'full-stack developer', 'Globex LLC'), 'Jane-Doe-FullStack-Developer-Globex');
  assert.equal(buildResumeFilename('Sam Lee', 'Data Engineer'), 'Sam-Lee-Data-Engineer');
});

test('accented names are kept', () => {
  assert.equal(buildResumeFilename('José Núñez', 'Data Engineer', 'Shopify'), 'José-Núñez-Data-Engineer-Shopify');
});

test('missing pieces fall back', () => {
  assert.equal(buildResumeFilename('', '', ''), 'Candidate-Resume');
  assert.equal(buildResumeFilename('Sam Lee', '', ''), 'Sam-Lee-Resume');
});

test('a name already downloaded is numbered', () => {
  const base = 'Saeed-Darvish-Software-Engineer-Google';
  assert.equal(uniqueResumeName(base, []), base);
  assert.equal(uniqueResumeName(base, [base.toLowerCase()]), `${base}-2`);
  assert.equal(uniqueResumeName(base, [base.toLowerCase(), `${base}-2`.toLowerCase()]), `${base}-3`);
});

test('a number never pushes the name past the limit', () => {
  const base = buildResumeFilename('Alexandra Montgomery', 'Software Engineer', 'Salesforce');
  const out = uniqueResumeName(base, [base.toLowerCase()]);
  assert.ok(out.length <= RESUME_FILENAME_MAX, out);
  assert.ok(out.endsWith('-2'), out);
});
