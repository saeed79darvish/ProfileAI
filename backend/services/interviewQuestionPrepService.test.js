const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareQuestion, cleanPrepare } = require('./interviewQuestionPrepService');

test('cleanPrepare keeps at most three real points and strips dashes and arrows', () => {
  assert.deepEqual(cleanPrepare(null), []);
  assert.deepEqual(cleanPrepare({ prepare: 'x' }), []);
  const out = cleanPrepare({ prepare: ['Know the basics — then go deeper.', 'short', 'Give one real example → with a number.', 'Close with the result you got.', 'A fourth point is dropped.'] });
  assert.equal(out.length, 3);
  assert.ok(out.every((p) => !/[—→]/.test(p)));
  assert.equal(out[0], 'Know the basics, then go deeper.');
});

test('prepareQuestion asks about the question and role, returns [] on nonsense', async () => {
  let seen;
  const out = await prepareQuestion({ prep: { role: 'Frontend Engineer', company: 'Acme' }, question: { text: 'What is the virtual DOM?' }, runModel: async (a) => { seen = a; return '{"prepare":["Explain it as a cheap copy React compares.","Say what it does not do.","Link it to keys in lists."]}'; } });
  assert.match(seen.prompt, /Frontend Engineer at Acme/);
  assert.match(seen.prompt, /virtual DOM/);
  assert.equal(out.length, 3);
  assert.deepEqual(await prepareQuestion({ prep: {}, question: { text: 'Q?' }, runModel: async () => 'garbage' }), []);
  assert.deepEqual(await prepareQuestion({ prep: {}, question: {}, runModel: async () => '{}' }), []);
  assert.deepEqual(await prepareQuestion({ prep: {}, question: { text: 'Q here?' }, runModel: async () => { throw new Error('down'); } }), []);
});
