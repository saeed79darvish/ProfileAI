const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mergeLearned, missingForVoice, essentialsMissing, peekSession, HANDOVER,
} = require('./coachVoiceService');

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

/* Knowing when to hang up. A call with no ending runs to the duration cap
   and drops mid-sentence, which is how the first real call felt. */

test('education and a home town do not keep anyone on the phone', () => {
  const gathered = {
    title: 'Registered Nurse',
    seniority: 'senior',
    company: 'County General',
    bullets: ['Ran a 12-bed unit'],
    skills: ['Triage'],
    target: 'Nurse Practitioner',
  };
  // Still on the written checklist, deliberately — two taps in the chat.
  assert.deepEqual(missingForVoice(gathered).sort(), [
    'education, a bootcamp or certifications',
    'where they are based',
  ]);
  // But not worth another spoken question.
  assert.deepEqual(essentialsMissing(gathered), []);
});

test('a call that has heard nothing is not finished', () => {
  assert.ok(essentialsMissing({}).length > 0);
  assert.ok(essentialsMissing({ title: 'Developer' }).length > 0);
});

test('the handover names what the screen will ask for', () => {
  // The browser closes the call on the back of this line, and the chat then
  // offers the upload — the sentence has to promise exactly that.
  assert.match(HANDOVER, /resume/i);
  assert.match(HANDOVER, /upload/i);
});

test('a call nobody has spoken on yet reports no state', () => {
  assert.equal(peekSession('never-dialled'), null);
});
