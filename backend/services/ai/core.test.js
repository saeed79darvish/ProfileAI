const test = require('node:test');
const assert = require('node:assert/strict');

const { supportsTemperature, extractText } = require('./core');

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


/* Reading the answer back out of a response. The Claude 5 family runs
   adaptive thinking by default and decides per request, so the same model
   returns [text] for an easy prompt and [thinking, text] for a hard one.
   Both shapes below were captured from the live API. */

test('a plain text response reads back unchanged', () => {
  assert.equal(extractText({ content: [{ type: 'text', text: '{"ok":1}' }] }), '{"ok":1}');
});

test('a thinking block in front of the answer is skipped, not returned', () => {
  /* The regression: content[0].text was undefined here, and the .trim()
     after it threw a TypeError that surfaced as a 400 on tailor-for-job. */
  const response = {
    content: [
      { type: 'thinking', thinking: 'weighing the tradeoffs' },
      { type: 'text', text: '{"ok":1}' },
    ],
  };
  assert.equal(extractText(response), '{"ok":1}');
});

test('several text blocks are joined in order', () => {
  const response = {
    content: [
      { type: 'thinking', thinking: '' },
      { type: 'text', text: '{"ok":' },
      { type: 'text', text: '1}' },
    ],
  };
  assert.equal(extractText(response), '{"ok":1}');
});

test('a response with no text at all fails loudly, naming the blocks', () => {
  /* Better than returning '' and letting JSON.parse report
     "Unexpected end of JSON input" three layers away. */
  assert.throws(
    () => extractText({ content: [{ type: 'thinking', thinking: 'x' }], stop_reason: 'max_tokens' }),
    /no text content.*thinking.*max_tokens/s
  );
  assert.throws(() => extractText({ content: [] }), /no text content/);
  assert.throws(() => extractText({}), /no text content/);
});
