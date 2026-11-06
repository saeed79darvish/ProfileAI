import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { buildFixtures, OUT_DIR } from './build-fixtures.mjs';

let M;
before(async () => {
  await buildFixtures();
  M = await import(resolve(OUT_DIR, 'answerMemory.mjs'));
});

const base = { question: 'Are you open to relocation?', answer: 'Yes', kind: 'choice', options: ['Yes', 'No'], company: 'Anthropic', jobTitle: 'Engineer' };

test('decideLearn keeps a plain dropdown choice with its options and job', () => {
  const d = M.decideLearn(base);
  assert.equal(d.learn, true);
  assert.deepEqual(d.payload, { question: 'Are you open to relocation?', answer: 'Yes', kind: 'choice', options: ['Yes', 'No'], company: 'Anthropic', jobTitle: 'Engineer' });
});

test('decideLearn cleans the question, drops placeholder options and caps their number', () => {
  const d = M.decideLearn({ ...base, question: '  Are you open to relocation? *  ', options: ['Select...', 'Yes', 'yes', 'No'] });
  assert.equal(d.payload.question, 'Are you open to relocation?');
  assert.deepEqual(d.payload.options, ['Yes', 'No']);
  const many = M.decideLearn({ ...base, options: Array.from({ length: 80 }, (_, i) => `Option ${i}`) });
  assert.equal(many.payload.options.length, 40);
});

test('decideLearn never learns sensitive questions', () => {
  for (const q of ['What is your gender?', 'Are you Hispanic or Latino?', 'Veteran status', 'Do you have a disability?', 'What is your age?', 'Religion', 'Sexual orientation', 'Have you been convicted of a crime?', 'What are your pronouns?', 'Race / ethnicity']) {
    const d = M.decideLearn({ ...base, question: q });
    assert.equal(d.learn, false, q);
    assert.equal(d.reason, 'sensitive', q);
  }
});

test('decideLearn skips long text, textareas, passwords and who-you-are fields', () => {
  const long = 'x'.repeat(81);
  assert.equal(M.decideLearn({ ...base, kind: 'text', answer: long }).learn, false);
  assert.equal(M.decideLearn({ ...base, kind: 'text', answer: 'x'.repeat(80) }).learn, true);
  assert.equal(M.decideLearn({ ...base, kind: 'text', answer: 'short', tag: 'textarea' }).learn, false);
  assert.equal(M.decideLearn({ ...base, kind: 'text', answer: 'hunter2', inputType: 'password' }).learn, false);
  assert.equal(M.decideLearn({ ...base, kind: 'text', question: 'Email address', answer: 'a@b.co' }).learn, false);
  assert.equal(M.decideLearn({ ...base, kind: 'text', question: 'Phone number', answer: '555 0100' }).learn, false);
  assert.equal(M.decideLearn({ ...base, kind: 'text', question: 'First name', answer: 'Sam' }).learn, false);
  assert.equal(M.decideLearn({ ...base, kind: 'text', question: 'Your answer', answer: 'Sam', fieldHints: 'last_name' }).learn, false);
  assert.equal(M.decideLearn({ ...base, kind: 'text', question: 'LinkedIn profile', answer: 'linkedin.com/in/x' }).learn, false);
  assert.equal(M.decideLearn({ ...base, kind: 'text', question: 'Desired salary range', answer: '150k' }).learn, true);
});

test('decideLearn skips empty and placeholder answers', () => {
  assert.equal(M.decideLearn({ ...base, answer: '' }).learn, false);
  assert.equal(M.decideLearn({ ...base, answer: 'Select...' }).learn, false);
  assert.equal(M.decideLearn({ ...base, question: 'ok' }).learn, false);
});

test('youAnsweredLine reads the way the panel shows it', () => {
  assert.equal(
    M.youAnsweredLine('Yes', { question: 'Are you open to relocation?', company: 'Anthropic' }),
    "You answered Yes to 'Are you open to relocation?' at Anthropic.",
  );
  assert.equal(M.youAnsweredLine('No', { question: 'Open to hybrid work?' }), "You answered No to 'Open to hybrid work?'.");
  assert.equal(M.youAnsweredLine('No', null), 'You answered No before.');
  assert.ok(M.youAnsweredLine('Yes', { question: 'q'.repeat(300) }).length < 160);
});

test('useSuggestionLabel names the stored answer', () => {
  assert.equal(M.useSuggestionLabel('Hybrid, 3 days'), 'Use Hybrid, 3 days');
  assert.ok(M.useSuggestionLabel('z'.repeat(200)).length <= 44);
});

test('buildReviewList puts reused answers first and keeps order', () => {
  const list = [
    { id: 'a', fromMemory: false },
    { id: 'b', fromMemory: true },
    { id: 'c', fromMemory: false },
    { id: 'd', fromMemory: true },
    { id: 'b', fromMemory: true },
  ];
  const r = M.buildReviewList(list);
  assert.deepEqual(r.reused.map((x) => x.id), ['b', 'd']);
  assert.deepEqual(r.rest.map((x) => x.id), ['a', 'c']);
});

test('reusedToast and isMemorySource', () => {
  assert.equal(M.reusedToast(2), 'Filled 2 from your earlier answers. Review them.');
  assert.equal(M.reusedToast(0), '');
  assert.equal(M.isMemorySource('learned'), true);
  assert.equal(M.isMemorySource('fact'), true);
  assert.equal(M.isMemorySource('ai'), false);
  assert.equal(M.isMemorySource('needs_you'), false);
});

test('a learned answer is ready, and a needs_you with a suggestion still needs the person', () => {
  const learned = { answer: 'Yes', source: 'learned', learnedId: 'l1' };
  assert.equal(M.deriveCardState({ detail: learned, answer: 'Yes' }), 'ready');
  assert.equal(M.sourceLine(learned), 'From your earlier answer');
  const needs = { answer: '', source: 'needs_you', suggestion: 'Hybrid' };
  assert.equal(M.deriveCardState({ detail: needs, answer: '' }), 'needs_you');
});

test('buildSavedRows lists learned first, newest first, without duplicating local copies', () => {
  const learned = [
    { id: '1', question: 'Open to relocation?', answer: 'Yes', kind: 'choice', company: 'Anthropic', updatedAt: '2026-11-01T10:00:00Z' },
    { id: '2', question: 'Open to hybrid?', answer: 'No', kind: 'choice', updatedAt: '2026-11-05T10:00:00Z' },
  ];
  const rows = M.buildSavedRows(learned, { 'open to relocation': 'old', 'Favorite editor': 'Vim' });
  assert.deepEqual(rows.map((r) => `${r.type}:${r.id}`), ['learned:2', 'learned:1', 'local:Favorite editor']);
  assert.equal(rows[1].meta, 'Anthropic, Nov 1, 2026');
  assert.equal(rows[0].meta, 'Nov 5, 2026');
  assert.equal(M.formatLearnedDate('nope'), '');
});
