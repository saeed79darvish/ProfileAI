const test = require('node:test');
const assert = require('node:assert/strict');

const { supportsTemperature } = require('./core');

/* The Claude 5 family rejects `temperature` outright — a 400, not a warning.
   Every AI call in this codebase passes one, so getting this rule wrong
   turns every AI feature off at once. The cases below were each checked
   against the live API, not reasoned about. */

test('the Claude 4 family still takes a temperature', () => {
  for (const model of ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-5-20251101']) {
    assert.equal(supportsTemperature(model), true, model);
  }
});

test('the Claude 5 family does not', () => {
  for (const model of ['claude-sonnet-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5', 'claude-fable-5-1']) {
    assert.equal(supportsTemperature(model), false, model);
  }
});

test('a model we have never seen is given the benefit of the doubt', () => {
  /* Only safe because callAI retries without the parameter when a model
     complains about it. Guessing "no temperature" instead would silently
     change the output of every 4.x call. */
  assert.equal(supportsTemperature('some-future-model'), true);
  assert.equal(supportsTemperature(''), true);
  assert.equal(supportsTemperature(undefined), true);
});

test('the rule keys on the major version, not on a list of names', () => {
  // A model released next month must not need a deploy to be handled.
  assert.equal(supportsTemperature('claude-sonnet-6'), false);
  assert.equal(supportsTemperature('claude-haiku-12-3'), false);
});
