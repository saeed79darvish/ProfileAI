const test = require('node:test');
const assert = require('node:assert');
const { coachTools, createToolRunner } = require('./coachAgent');

const names = (tools) => tools.map((t) => t.name);

test('go_back is offered only for answers the page can take back', () => {
  assert.ok(!names(coachTools({ answered: [] })).includes('go_back'));
  const tools = coachTools({ answered: [{ step: 'careerStage', question: 'Where are you?', answer: 'New grad' }] });
  const goBack = tools.find((t) => t.name === 'go_back');
  assert.deepStrictEqual(goBack.input_schema.properties.step.enum, ['careerStage']);
});

test('a call opens only when the server says one can', () => {
  const open = createToolRunner({ access: { voice: 'can_call' } });
  assert.strictEqual(open.run('start_voice_call').done, true);
  assert.deepStrictEqual(open.actions, [{ type: 'voice' }]);

  // The bug this replaced: a guest who had used the call was told nothing.
  const used = createToolRunner({ access: { voice: 'guest_call_used', signedIn: false } });
  const result = used.run('start_voice_call');
  assert.strictEqual(result.done, false);
  assert.match(result.next, /offer_account/);
  assert.deepStrictEqual(used.actions, []);
  used.run('offer_account', { reason: 'voice' });
  assert.deepStrictEqual(used.actions, [{ type: 'account', reason: 'voice' }]);
});

test('signed-in people are never offered an account', () => {
  const tools = createToolRunner({ access: { signedIn: true, voice: 'plan_limit' } });
  assert.strictEqual(tools.run('offer_account', { reason: 'save' }).done, false);
  assert.strictEqual(tools.run('start_voice_call').done, false);
  assert.deepStrictEqual(tools.actions, []);
});

test('one thing goes under a reply', () => {
  const tools = createToolRunner({ access: { voice: 'can_call' } });
  tools.run('offer_import');
  assert.strictEqual(tools.run('start_voice_call').done, false);
  assert.deepStrictEqual(tools.actions, [{ type: 'import' }]);
});

test('go_back only takes back a listed answer', () => {
  const state = { answered: [{ step: 'careerStage', question: 'Where are you?', answer: 'New grad' }] };
  const tools = createToolRunner({ state });
  assert.strictEqual(tools.run('go_back', { step: 'sector' }).done, false);
  assert.strictEqual(tools.run('go_back', { step: 'careerStage' }).done, true);
  assert.deepStrictEqual(tools.actions, [{ type: 'rewind', step: 'careerStage' }]);
});

test('features are looked up, not made up', () => {
  const tools = createToolRunner();
  assert.strictEqual(tools.run('look_up_feature', { feature: 'tailor_resume' }).found, true);
  assert.strictEqual(tools.run('look_up_feature', { feature: 'teleport' }).found, false);
  assert.deepStrictEqual(tools.actions, []);
});
