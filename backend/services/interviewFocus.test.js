const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanFocus, focusScore, focusSentence, MAX_AREAS, AREAS } = require('./interviewFocus');
const { pickQuestions, practiceInstructions } = require('./interviewPracticeService');

test('cleanFocus keeps known ids and choices only, caps areas, returns null when empty', () => {
  assert.equal(cleanFocus(null), null);
  assert.equal(cleanFocus({ areas: ['x'], companyType: 'y', worry: 'z' }), null);
  assert.deepEqual(cleanFocus({ areas: ['performance', 'performance', 'testing'], companyType: 'startup', worry: 'behavioral' }), { areas: ['performance', 'testing'], companyType: 'startup', worry: 'behavioral' });
  assert.equal(cleanFocus({ areas: Object.keys(AREAS) }).areas.length, MAX_AREAS);
  assert.equal(cleanFocus([]), null);
});

test('focusScore counts the chosen areas a text touches, never more for repeats', () => {
  const focus = { areas: ['performance', 'accessibility'] };
  assert.equal(focusScore('How would you improve page load performance and caching?', focus), 1);
  assert.equal(focusScore('Make a slow list accessible with ARIA and fast with lazy loading', focus), 2);
  assert.equal(focusScore('Tell me about a conflict', focus), 0);
  assert.equal(focusScore('anything', null), 0);
});

test('focusSentence reads as plain speech and is empty without a focus', () => {
  assert.equal(focusSentence(null), '');
  const s = focusSentence({ areas: ['performance', 'leading'], companyType: 'scale_up', worry: 'system_design' });
  assert.match(s, /web performance, leading and influencing people/);
  assert.match(s, /a scale-up/);
  assert.match(s, /system design/);
  assert.ok(!/[—–]/.test(s));
});

test('practice leans on the focus: matching questions first, matching topics fill first, the coach is told', () => {
  const prep = {
    role: 'Staff frontend engineer',
    questions: [
      { text: 'Tell me about a time you disagreed with a manager', category: 'behavioral', frequency: 5 },
      { text: 'How would you improve the load performance of a slow page?', category: 'other', frequency: 1 },
      { text: 'What is the virtual DOM and why does it help?', category: 'role_specific', frequency: 4 },
      { text: 'Why do you want to work here?', category: 'other', frequency: 6 },
      { text: 'Describe a project you are proud of', category: 'other', frequency: 5 },
      { text: 'Explain how closures work in JavaScript', category: 'role_specific', frequency: 4 },
      { text: 'What does your ideal team look like?', category: 'other', frequency: 3 },
    ],
    topics: [{ name: 'Design systems' }, { name: 'Web performance' }],
  };
  const plain = pickQuestions({ prep });
  const steered = pickQuestions({ prep, focus: { areas: ['performance'] } });
  assert.ok(!plain.some((q) => /load performance/.test(q.text)));
  assert.ok(steered.some((q) => /load performance/.test(q.text)));
  const thin = pickQuestions({ prep: { questions: [], topics: prep.topics }, focus: { areas: ['performance'] } });
  assert.match(thin[0].text, /Web performance/);
  const text = practiceInstructions({ prep, questions: steered, focus: { areas: ['performance'], worry: 'speaking_clearly' } });
  assert.match(text, /WHAT THEY ARE AIMING AT/);
  assert.match(text, /explaining their thinking out loud/);
  assert.doesNotMatch(practiceInstructions({ prep, questions: steered }), /AIMING AT/);
});
