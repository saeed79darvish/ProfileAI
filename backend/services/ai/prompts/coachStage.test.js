const { test } = require('node:test');
const assert = require('node:assert/strict');

const { stageOf, stageGuidance, gapCheckPrompt, suggestPrompt } = require('./coachStage');

/* The typed coach sends the stage as the label the person tapped; the call
   gets the raw draft with the id. Both must land on the same guidance, or
   the call and the chat would treat the same person differently. */
test('the stage is read from the label or the id', () => {
  assert.equal(stageOf({ about: { careerStage: "I'm a new grad / student" } }), 'new_grad');
  assert.equal(stageOf({ careerStage: 'new_grad' }), 'new_grad');
  assert.equal(stageOf({ about: { careerStage: 'Changing careers' } }), 'career_change');
  assert.equal(stageOf({ about: { careerStage: 'Only internships so far' } }), 'internship');
  assert.equal(stageOf({ about: { careerStage: 'Self-taught / bootcamp' } }), 'self_taught');
  assert.equal(stageOf({ about: { careerStage: 'I have work experience' } }), 'experienced');
  assert.equal(stageOf({}), '');
});

test('a new grad is never asked about a job they have not had', () => {
  const block = stageGuidance({ careerStage: 'new_grad' });
  assert.match(block, /Never ask about a job/);
  assert.equal(stageGuidance({}), '', 'no stage, no block');
});

test('the final read and the suggestions carry who they are', () => {
  const profile = { about: { careerStage: 'Changing careers', target: 'Product Manager' }, title: 'Nurse' };
  assert.match(gapCheckPrompt({ profile }), /changing careers/i);
  assert.match(suggestPrompt({ profile, kind: 'skills', question: 'What are you good at?' }), /skills a recruiter would filter on/);
});

test('the suggestions read what they said, not only what was filed', () => {
  const profile = { about: { field: 'Software & IT', careerStage: 'New grad or student' } };
  const prompt = suggestPrompt({ profile, kind: 'titles', question: 'What title fits?', said: ['new grad, I want to be a data scientist'] });
  assert.match(prompt, /IN THEIR OWN WORDS/);
  assert.match(prompt, /I want to be a data scientist/);
  assert.doesNotMatch(suggestPrompt({ profile, kind: 'titles', question: 'q' }), /IN THEIR OWN WORDS/, 'nothing said, no block');
});
