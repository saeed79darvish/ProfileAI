const test = require('node:test');
const assert = require('node:assert/strict');

const { filterLearned, VOICE_FIELDS } = require('./coachRealtimeService');
const { coachVoiceInstructions, COACH_VOICE_TOOLS } = require('./ai/prompts/coachVoiceSession');

/* A tool call is model output, and a profile is not the place to discover
   that a prompt was followed loosely. */

test('a call can only write fields a profile actually has', () => {
  const clean = filterLearned({
    title: 'Staff Backend Engineer',
    salaryExpectation: '200k',
    isAdmin: true,
  });
  assert.deepEqual(clean, { title: 'Staff Backend Engineer' });
});

test('empty values are dropped rather than written as blanks', () => {
  assert.deepEqual(filterLearned({ title: '', company: null, school: undefined }), {});
  assert.deepEqual(filterLearned({ skills: ['', '  '] }), {});
});

test('what they said is kept, trimmed but not tidied', () => {
  const clean = filterLearned({ title: '  growth stuff for a fintech  ', yearsExperience: 8 });
  assert.equal(clean.title, 'growth stuff for a fintech');
  assert.equal(clean.yearsExperience, 8);
});

test('the tool offers exactly the fields the filter allows', () => {
  const tool = COACH_VOICE_TOOLS.find((t) => t.name === 'remember_about_them');
  for (const field of Object.keys(tool.parameters.properties)) {
    assert.ok(VOICE_FIELDS.has(field), `${field} is offered to the model but would be discarded`);
  }
});

test('the call has one way to end itself and no other powers', () => {
  assert.deepEqual(COACH_VOICE_TOOLS.map((t) => t.name).sort(), [
    'hand_back_to_chat',
    'remember_about_them',
  ]);
});

/* The guardrails used to be re-sent to Claude on every single turn. They are
   now one block of instructions the session opens with and never hears
   again, so it matters that they are actually in there. */

test('the session still carries the guardrails the typed coach has', () => {
  const instructions = coachVoiceInstructions({ firstName: 'Saeed' });
  assert.match(instructions, /You are an AI/i);
  assert.match(instructions, /Never quote a price/i);
  assert.match(instructions, /poems, code or\s+essays/i);
  assert.match(instructions, /resume/i);
});

test('a call never asks for what the chat already collected', () => {
  const instructions = coachVoiceInstructions({
    firstName: 'Saeed',
    profile: { title: 'Staff Backend Engineer', skills: ['Go', 'Kubernetes'] },
  });
  assert.match(instructions, /NEVER ASK FOR THESE/);
  assert.match(instructions, /title: Staff Backend Engineer/);
  assert.match(instructions, /skills: Go, Kubernetes/);
});

test('an empty profile leaves out the already-known block entirely', () => {
  // An empty "here is what you know" heading invites the model to invent one.
  assert.doesNotMatch(coachVoiceInstructions({ firstName: 'Saeed' }), /NEVER ASK FOR THESE/);
});
