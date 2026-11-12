const test = require('node:test');
const assert = require('node:assert/strict');
const { parseJobMatchRead } = require('./jobMatchParse');

const req = (n) => ({ requirement: `Requirement ${n}`, type: 'skill', hardness: 'must', coverage: 'strong', evidence: '[1] Acme', note: '' });
const full = (n) => JSON.stringify({ jobTitle: 'Engineer', requirements: Array.from({ length: n }, (_, i) => req(i + 1)), roleFit: 0.9, seniorityFit: 1, recency: 0.9, verdict: 'Good fit.' });

test('a complete answer is read as is', () => {
  const { read, repaired } = parseJobMatchRead(`Here you go:\n${full(3)}`);
  assert.equal(read.requirements.length, 3);
  assert.equal(read.roleFit, 0.9);
  assert.equal(repaired, false);
});

test('an answer cut off after the fit numbers is repaired and keeps them', () => {
  const cut = full(3).replace(/"verdict":"Good fit\."\}$/, '"verdict":"Good fi');
  const { read, repaired } = parseJobMatchRead(cut);
  assert.ok(read, 'should be recovered');
  assert.equal(read.requirements.length, 3);
  assert.equal(read.roleFit, 0.9);
  assert.equal(repaired, true);
});

test('an answer cut off inside the requirements has no fit numbers, so it is rejected, not scored 0', () => {
  const whole = full(8);
  const cut = whole.slice(0, whole.indexOf('Requirement 6'));
  const { read } = parseJobMatchRead(cut);
  assert.equal(read, null);
});

test('prose and empty answers are unreadable', () => {
  assert.equal(parseJobMatchRead('I cannot do that.').read, null);
  assert.equal(parseJobMatchRead('').read, null);
  assert.equal(parseJobMatchRead(null).read, null);
});
