const test = require('node:test');
const assert = require('node:assert/strict');
const svc = require('./interviewCodeService');

test('cleanCode: trims, normalizes line ends, refuses almost nothing, caps length', () => {
  assert.equal(svc.cleanCode('x'), '');
  assert.equal(svc.cleanCode('\n\nconst a = 1;   \r\nconst b = 2;\n\n'), 'const a = 1;\nconst b = 2;');
  assert.equal(svc.cleanCode('a'.repeat(20000)).length, svc.MAX_CODE_CHARS);
});

test('cleanReview: prose loses dashes and arrows, code keeps => and ->', () => {
  const r = svc.cleanReview({
    verdict: 'nope', summary: 'Works — mostly.', worked: ['Good → names'], issues: [{ what: 'Bug', fix: 'Fix it' }, { what: '', fix: 'x' }],
    improved: '```js\nconst f = (x) => x;\n```', tips: ['a', 'b', 'c', 'd'],
  });
  assert.equal(r.verdict, 'good');
  assert.equal(r.summary, 'Works, mostly.');
  assert.ok(!/[→—]/.test(r.worked[0]));
  assert.equal(r.issues.length, 1);
  assert.equal(r.improved, 'const f = (x) => x;');
  assert.equal(r.tips.length, 3);
  assert.equal(svc.cleanReview(null), null);
  assert.equal(svc.cleanReview({}), null);
});

test('reviewCode: the model sees the question, language and code; the language falls back', async () => {
  let seen;
  const out = await svc.reviewCode({
    prep: { role: 'Staff Frontend Engineer', company: '' }, question: 'Debounce a function', language: 'cobol', code: 'function debounce(fn) { return fn; }',
    runModel: async (a) => { seen = a; return JSON.stringify({ summary: 'Close.', issues: [{ what: 'No timer', fix: 'Use setTimeout' }] }); },
  });
  assert.match(seen.prompt, /Staff Frontend Engineer/);
  assert.match(seen.prompt, /Debounce a function/);
  assert.match(seen.prompt, /function debounce/);
  assert.equal(out.language, 'javascript');
  assert.equal(out.review.improved, 'function debounce(fn) { return fn; }');
});
