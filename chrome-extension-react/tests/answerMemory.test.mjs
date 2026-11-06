import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { buildFixtures, OUT_DIR } from './build-fixtures.mjs';

let M;
before(async () => {
  await buildFixtures();
  M = await import(resolve(OUT_DIR, 'answerMemory.mjs'));
});

test('parseWordHint reads ranges, maximums and minimums', () => {
  assert.deepEqual(M.parseWordHint('Please answer in 200-400 words'), { min: 200, max: 400 });
  assert.deepEqual(M.parseWordHint('200 to 400 words'), { min: 200, max: 400 });
  assert.deepEqual(M.parseWordHint('Maximum 250 words'), { min: 0, max: 250 });
  assert.deepEqual(M.parseWordHint('up to 1,000 words'), { min: 0, max: 1000 });
  assert.deepEqual(M.parseWordHint('300 words or less'), { min: 0, max: 300 });
  assert.deepEqual(M.parseWordHint('At least 100 words'), { min: 100, max: 0 });
  assert.equal(M.parseWordHint('Keep it under 500 characters'), null);
  assert.equal(M.parseWordHint(''), null);
  assert.equal(M.parseWordHint(null), null);
});

test('wordStatus flags under, over and ok', () => {
  const words = (n) => Array(n).fill('w').join(' ');
  assert.equal(M.wordStatus(words(10), { min: 20, max: 40 }).tone, 'under');
  assert.equal(M.wordStatus(words(30), { min: 20, max: 40 }).tone, 'ok');
  assert.equal(M.wordStatus(words(50), { min: 20, max: 40 }).tone, 'over');
  assert.equal(M.wordStatus(words(5), null).tone, 'plain');
  assert.equal(M.countWords('  a  b\nc '), 3);
  assert.equal(M.countWords(''), 0);
});

test('pickOption matches exactly and never guesses', () => {
  const yn = ['Yes', 'No'];
  assert.equal(M.pickOption(yn, { answer: 'No' }), 'No');
  assert.equal(M.pickOption(yn, { choiceValue: 'yes' }), 'Yes');
  assert.equal(M.pickOption(['Yes, I will need sponsorship', 'No, I will not'], { answer: 'No' }), 'No, I will not');
  assert.equal(M.pickOption(['Remote', 'Hybrid', 'On-site'], { choiceValue: 'hybrid_ok' }), 'Hybrid');
  assert.equal(M.pickOption(['Remote', 'Hybrid', 'On-site'], { choiceValue: 'onsite_ok' }), 'On-site');
  // ambiguous or unrelated: no pick
  assert.equal(M.pickOption(['Yes - A', 'Yes - B'], { answer: 'Yes' }), null);
  assert.equal(M.pickOption(['Canada', 'Mexico'], { answer: 'No' }), null);
  assert.equal(M.pickOption([], { answer: 'No' }), null);
  assert.equal(M.pickOption(yn, {}), null);
});

const CATALOG = {
  facts: [
    { id: 'workAuthorization', label: 'Work authorization', ask: '', type: 'choice', detect: ['authorized to work', 'work authorization'] },
    { id: 'sponsorshipNow', label: 'Sponsorship', ask: '', type: 'yesno', detect: ['require (visa )?sponsorship', 'need sponsorship'] },
    { id: 'sponsorshipFuture', label: 'Sponsorship later', ask: '', type: 'yesno', detect: ['in the future require', 'now or in the future'] },
  ],
  stories: [],
};

test('matchFact finds the most specific fact and skips sensitive questions', () => {
  assert.equal(M.matchFact('Will you now or in the future require sponsorship?', CATALOG).id, 'sponsorshipFuture');
  assert.equal(M.matchFact('Do you require visa sponsorship?', CATALOG).id, 'sponsorshipNow');
  assert.equal(M.matchFact('Are you authorized to work in Canada?', CATALOG).id, 'workAuthorization');
  assert.equal(M.matchFact('What is your favourite colour?', CATALOG), null);
  assert.equal(M.matchFact('Gender', CATALOG), null);
  assert.equal(M.matchFact('Do you require sponsorship?', null), null);
  assert.equal(M.isSensitiveQuestion('Are you a protected veteran?'), true);
  assert.equal(M.isSensitiveQuestion('Why this company?'), false);
});

test('deriveCardState and progress', () => {
  const fact = { answer: 'No', source: 'fact' };
  assert.equal(M.deriveCardState({ answer: 'No', detail: fact }), 'ready');
  assert.equal(M.deriveCardState({ answer: 'Text', detail: { answer: 'Text', source: 'ai' } }), 'ai');
  assert.equal(M.deriveCardState({ answer: '', detail: { answer: '', source: 'needs_you', needsFact: { id: 'x' } } }), 'needs_you');
  assert.equal(M.deriveCardState({ answer: '', optional: true, detail: { answer: '', source: 'ai' } }), 'skipped');
  assert.equal(M.deriveCardState({ answer: 'Mine', edited: true, detail: { answer: '', source: 'ai' } }), 'ready');
  const p = M.progressOf([
    { state: 'ready' }, { state: 'ai', done: true }, { state: 'needs_you' }, { state: 'skipped' }, { state: 'ready', loading: true },
  ]);
  assert.deepEqual(p, { ready: 2, total: 4, done: 1, needsYou: 1 });
  assert.equal(M.progressLabel(p), '2 of 4 ready');
});

test('sourceLine never says cached', () => {
  const lines = [
    M.sourceLine({ answer: 'x', source: 'profile' }),
    M.sourceLine({ answer: 'x', source: 'fact' }),
    M.sourceLine({ answer: 'x', source: 'story' }),
    M.sourceLine({ answer: 'x', source: 'ai' }, true),
    M.sourceLine({ answer: 'x', source: 'ai' }),
    M.sourceLine({ answer: '', source: 'needs_you' }),
  ];
  assert.equal(lines[0], 'From your profile');
  assert.equal(lines[1], 'From what you told us');
  assert.equal(lines[3], 'Saved for this job');
  for (const l of lines) assert.ok(!/cached/i.test(l) && !/[—→]/.test(l));
});

test('applyRulesVersion discards old caches exactly once', () => {
  const old = { a: { answer: 'invented' } };
  const first = M.applyRulesVersion(old, undefined);
  assert.deepEqual(first.cache, {});
  assert.equal(first.reset, true);
  assert.equal(first.version, M.ANSWERS_RULES_VERSION);
  const again = M.applyRulesVersion({ b: 1 }, M.ANSWERS_RULES_VERSION);
  assert.deepEqual(again.cache, { b: 1 });
  assert.equal(again.reset, false);
});

test('buildSeedStoryPatch maps keys and lets the server win', () => {
  const r = M.buildSeedStoryPatch(
    { career_motivation: ' I like building ', work_style: 'Async', ideal_role: '', bogus: 'x' },
    { workStyle: { text: 'Already saved' } },
  );
  assert.deepEqual(r.patch, { motivation: { text: 'I like building' } });
  assert.equal(r.count, 1);
  assert.equal(M.buildSeedStoryPatch(null, {}).count, 0);
});

test('mic errors are classified and timers format', () => {
  assert.equal(M.classifyMicError({ name: 'NotAllowedError' }), 'denied');
  assert.equal(M.classifyMicError({ name: 'NotFoundError' }), 'missing');
  assert.equal(M.classifyMicError(new Error('x')), 'other');
  assert.equal(M.formatTimer(65), '1:05');
  for (const p of ['denied', 'missing', 'unsupported', 'other']) assert.ok(!/[—→]/.test(M.micProblemMessage(p)));
});

test('placeholder rows are dropped and options are cleaned', () => {
  assert.equal(M.isPlaceholderOption('Select...'), true);
  assert.equal(M.isPlaceholderOption('Please select'), true);
  assert.equal(M.isPlaceholderOption(''), true);
  assert.equal(M.isPlaceholderOption('Yes'), false);
  assert.deepEqual(M.cleanOptionTexts(['Select...', ' Yes ', 'No', 'yes', '']), ['Yes', 'No']);
});

test('optionYesNo only reads plain yes and no', () => {
  assert.equal(M.optionYesNo('Yes'), 'yes');
  assert.equal(M.optionYesNo('No.'), 'no');
  assert.equal(M.optionYesNo('Yes, I will need sponsorship'), 'yes');
  assert.equal(M.optionYesNo('No, I do not'), 'no');
  assert.equal(M.optionYesNo('Maybe'), null);
  assert.equal(M.optionYesNo('No preference'), null);
  assert.equal(M.optionYesNo('Decline to answer'), null);
  assert.equal(M.optionYesNo(''), null);
});

test('saveDecision saves only clear yes or no answers to yes or no facts', () => {
  const yesno = { id: 'sponsorshipNow', type: 'yesno' };
  const reloc = { id: 'openToRelocation', type: 'choice', choices: [{ value: 'yes' }, { value: 'no' }, { value: 'depends' }] };
  const office = { id: 'officeComfort', type: 'choice', choices: [{ value: 'remote_only' }, { value: 'hybrid_ok' }] };
  const q = 'Do you require visa sponsorship?';
  assert.deepEqual(M.saveDecision(yesno, q, 'No'), { factId: 'sponsorshipNow', value: 'no' });
  assert.deepEqual(M.saveDecision(reloc, 'Are you open to relocation?', 'Yes'), { factId: 'openToRelocation', value: 'yes' });
  assert.equal(M.saveDecision(yesno, q, 'Maybe'), null);
  assert.equal(M.saveDecision(office, 'How do you feel about the office?', 'Yes'), null);
  assert.equal(M.saveDecision(null, q, 'Yes'), null);
  assert.equal(M.saveDecision({ id: 'x', type: 'yesno' }, 'Are you a protected veteran?', 'Yes'), null);
  assert.equal(M.canSaveFromOptions(yesno, q, ['Yes', 'No']), true);
  assert.equal(M.canSaveFromOptions(yesno, q, ['Maybe', 'Later']), false);
  assert.equal(M.canSaveFromOptions(office, q, ['Yes', 'No']), false);
});
