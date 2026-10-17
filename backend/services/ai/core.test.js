const test = require('node:test');
const assert = require('node:assert/strict');

const { supportsTemperature, extractText, createMessage, withThinkingOff } = require('./core');

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


/* Turning thinking off. The forms below are what the live API accepts — there
   is no major-version rule, so these are negotiated rather than looked up. */

const refuses = (/** @type {string[]} */ forms) => {
  /* Stands in for the API: rejects the named thinking forms the way it does,
     with a 400 that mentions `thinking`. */
  const calls = [];
  return {
    calls,
    messages: {
      create: async (request) => {
        calls.push(request);
        const type = request.thinking && request.thinking.type;
        if (type && forms.includes(type)) {
          const err = new Error(`"thinking.type.${type}" is not supported for this model.`);
          err.status = 400;
          throw err;
        }
        return { content: [{ type: 'text', text: 'ok' }] };
      },
    },
  };
};

test('a model that takes between_tools is asked once, with no wasted call', async () => {
  const client = refuses(['disabled']);
  const res = await createMessage(client, { model: 'probe-between-tools', max_tokens: 6000, messages: [] });
  assert.equal(res.content[0].text, 'ok');
  assert.equal(client.calls.length, 1);
  assert.deepEqual(client.calls[0].thinking, { type: 'between_tools' });
});

test('concurrent first calls still land on the form that works', async () => {
  // Four requests in flight before any of them has learned the answer. Each
  // stepping the shared choice forward used to skip "disabled" altogether and
  // leave the model thinking on every call.
  const client = refuses(['between_tools']);
  const run = () => createMessage(client, { model: 'probe-concurrent', max_tokens: 4000, messages: [] });
  const results = await Promise.all([run(), run(), run(), run()]);
  assert.ok(results.every((r) => r.content[0].text === 'ok'));
  const accepted = client.calls.filter((c) => c.thinking?.type !== 'between_tools');
  assert.ok(accepted.every((c) => c.thinking?.type === 'disabled'), 'a call went out with thinking left on');
  assert.ok(accepted.every((c) => c.max_tokens === 4000), 'a call was given thinking headroom');
});

test('a model that refuses it falls through to disabled, then remembers', async () => {
  const client = refuses(['between_tools']);
  await createMessage(client, { model: 'probe-disabled', max_tokens: 6000, messages: [] });
  assert.deepEqual(client.calls.map((c) => c.thinking.type), ['between_tools', 'disabled']);

  // The second call must not repeat the rejected form.
  await createMessage(client, { model: 'probe-disabled', max_tokens: 6000, messages: [] });
  assert.equal(client.calls.length, 3);
  assert.deepEqual(client.calls[2].thinking, { type: 'disabled' });
});

test('a model that always thinks is given a budget for it instead', async () => {
  /* The regression this whole mechanism exists for: thinking is spent out of
     max_tokens, so leaving the tuned 6000 in place let it starve the answer. */
  const client = refuses(['between_tools', 'disabled']);
  await createMessage(client, { model: 'probe-mandatory', max_tokens: 6000, messages: [] });
  const last = client.calls[client.calls.length - 1];
  assert.equal(last.thinking, undefined, 'thinking param dropped');
  assert.ok(last.max_tokens > 6000, `expected headroom above 6000, got ${last.max_tokens}`);
  assert.ok(last.max_tokens <= 32000, 'stays within the output ceiling');
});

test('a 400 that is not about thinking is a real error', async () => {
  const client = {
    messages: {
      create: async () => {
        const err = new Error('credit balance is too low');
        err.status = 400;
        throw err;
      },
    },
  };
  await assert.rejects(
    () => createMessage(client, { model: 'probe-other-400', max_tokens: 100, messages: [] }),
    /credit balance/
  );
});

test('the budget is left alone while a form is still being tried', () => {
  const request = { model: 'probe-untouched', max_tokens: 6000, messages: [] };
  assert.equal(withThinkingOff(request).max_tokens, 6000);
  assert.equal(request.thinking, undefined, 'the caller\'s request is not mutated');
});
