const test = require('node:test');
const assert = require('node:assert/strict');

const { mergeLearned, missingForVoice } = require('./coachVoiceService');

/* What a call collects, accumulated across turns. Vapi re-sends the
   transcript each turn but knows nothing about a profile, so the merge is
   where a ten-minute conversation becomes a dozen fields. */

test('what a call learns accumulates instead of overwriting', () => {
  const learned = {};
  mergeLearned(learned, { title: 'Staff Frontend Developer', skills: ['React'] });
  mergeLearned(learned, { skills: ['TypeScript'], company: 'Acme' });
  assert.equal(learned.title, 'Staff Frontend Developer');
  assert.equal(learned.company, 'Acme');
  assert.deepEqual(learned.skills, ['React', 'TypeScript']);
});

test('the first answer wins, so a profile does not flap mid-call', () => {
  // "Acme" then "Acme Corp" is one employer mentioned twice, not a correction.
  const learned = { company: 'Acme' };
  mergeLearned(learned, { company: 'Acme Corp' });
  assert.equal(learned.company, 'Acme');
});

test('a skill said twice is listed once', () => {
  const learned = { skills: ['React'] };
  mergeLearned(learned, { skills: ['React', 'Node.js'] });
  assert.deepEqual(learned.skills, ['React', 'Node.js']);
});

test('the checklist shrinks as the call goes on', () => {
  const empty = missingForVoice({});
  assert.ok(empty.length >= 6);
  const far = missingForVoice({
    title: 'Registered Nurse',
    seniority: 'senior',
    company: 'County General',
    bullets: ['Ran a 12-bed unit'],
    skills: ['Triage'],
    school: 'State',
    location: 'Leeds',
    target: 'Nurse Practitioner',
  });
  assert.deepEqual(far, []);
});
