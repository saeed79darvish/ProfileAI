const test = require('node:test');
const assert = require('node:assert/strict');

const { makeDigestLevelMismatch } = require('./jobDigestService');

const intern = { title: 'Software Engineering Intern' };
const entry = { title: 'Software Engineer', experienceLevel: 'entry' };

test('without stated preferences the digest keeps its inferred rule', () => {
  assert.equal(makeDigestLevelMismatch({ inferredLevel: 'mid' })(intern), true);
  assert.equal(makeDigestLevelMismatch({ inferredLevel: 'mid' })(entry), false);
  assert.equal(makeDigestLevelMismatch({ inferredLevel: 'senior' })(entry), true);
  assert.equal(makeDigestLevelMismatch({ inferredLevel: 'entry' })(intern), false);
});

test('a stated student stage keeps internships even when inference says senior', () => {
  const mismatch = makeDigestLevelMismatch({ constraints: { careerStage: 'new_grad' }, inferredLevel: 'senior' });
  assert.equal(mismatch(intern), false);
  assert.equal(mismatch(entry), false);
});

test('a stated senior level drops entry roles even when inference says mid', () => {
  const mismatch = makeDigestLevelMismatch({ constraints: { seniority: 'senior' }, inferredLevel: 'mid' });
  assert.equal(mismatch(entry), true);
  assert.equal(mismatch(intern), true);
});
