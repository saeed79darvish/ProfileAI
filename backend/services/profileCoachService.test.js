const test = require('node:test');
const assert = require('node:assert/strict');

const { withoutQuestions } = require('./profileCoachService');

test('an answer to their question survives once the follow-up is spent', () => {
  assert.equal(
    withoutQuestions('It builds the server side of apps, for someone just out of school. Want that one?'),
    'It builds the server side of apps, for someone just out of school.',
  );
  assert.equal(withoutQuestions('Which one fits?'), '', 'a bare question is still dropped');
});
