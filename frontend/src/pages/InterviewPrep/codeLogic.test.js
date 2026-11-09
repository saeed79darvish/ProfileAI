import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questionKind, codeQuestions, applyTab, canReview, reviewBody, verdictTag, cleanAttempt, cleanAttempts, attemptsFor, attemptsLabel, reviewError } from './codeLogic.js';

test('questionKind: code is written, everything else can be said aloud', () => {
  assert.equal(questionKind({ text: 'Implement a debounce function', category: 'coding' }), 'code');
  assert.equal(questionKind({ text: 'Reverse a linked list', category: 'coding' }), 'code');
  assert.equal(questionKind({ text: 'How does the event loop work?', category: 'coding' }), 'spoken');
  assert.equal(questionKind({ text: 'What is the virtual DOM?', category: 'role_specific' }), 'spoken');
  assert.equal(questionKind({ text: 'Design a feed', category: 'system_design' }), 'spoken');
  assert.equal(questionKind({ text: 'Tell me about a conflict', category: 'behavioral' }), 'spoken');
});

test('codeQuestions: only coding questions, deduped, the reported-for tail removed', () => {
  const prep = { questions: [
    { text: 'Implement a debounce function (reported for a phone screen).', category: 'coding' },
    { text: 'implement a debounce function', category: 'coding' },
    { text: 'What is the virtual DOM and why does it help?', category: 'role_specific' },
    { text: 'React, CSS, and JavaScript implementation questions', category: 'coding' },
    { text: 'Write a hook that fetches data and cancels on unmount', category: 'role_specific' },
  ] };
  assert.deepEqual(codeQuestions(prep).map((q) => q.text), ['Implement a debounce function', 'Write a hook that fetches data and cancels on unmount']);
  assert.deepEqual(codeQuestions(null), []);
});

test('applyTab: Tab inserts two spaces, Shift+Tab takes them back', () => {
  assert.deepEqual(applyTab('ab', 1, 1), { value: 'a  b', start: 3, end: 3 });
  assert.deepEqual(applyTab('abcd', 1, 3), { value: 'a  d', start: 3, end: 3 });
  assert.deepEqual(applyTab('x\n  y', 4, 4, true), { value: 'x\ny', start: 2, end: 2 });
  assert.deepEqual(applyTab('x', 1, 1, true), { value: 'x', start: 1, end: 1 });
});

test('canReview and reviewBody', () => {
  assert.equal(canReview('Q', 'short'), false);
  assert.equal(canReview('', 'const a = 1; const b = 2;'), false);
  assert.equal(canReview('Q', 'const a = 1; const b = 2;'), true);
  assert.deepEqual(reviewBody({ question: '  Q  ', language: 'cobol', code: 'x' }), { question: 'Q', language: 'javascript', code: 'x' });
});

test('attempts: malformed rows are dropped, reviews default to empty, filtered by question', () => {
  assert.equal(cleanAttempt(null), null);
  assert.equal(cleanAttempt({ code: 5 }), null);
  const a = cleanAttempt({ id: 1, question: 'Q one', language: 'python', code: 'x = 1', review: { verdict: 'strong', issues: [{ what: 'a', fix: 'b' }, { what: '' }], tips: ['t', 3] } });
  assert.equal(a.language, 'python');
  assert.equal(a.review.issues.length, 1);
  assert.deepEqual(a.review.tips, ['t']);
  assert.equal(cleanAttempt({ code: 'x', question: 'Q' }).review.summary, '');
  const list = cleanAttempts([{ question: 'Q one', code: 'a' }, { question: 'q ONE', code: 'b' }, { question: 'Other', code: 'c' }, 'junk']);
  assert.equal(list.length, 3);
  assert.equal(attemptsFor(list, ' Q one ').length, 2);
  assert.equal(attemptsLabel(1), '1 attempt');
  assert.equal(attemptsLabel(3), '3 attempts');
  assert.equal(verdictTag('strong').label, 'Strong answer');
  assert.equal(verdictTag('???').label, 'Good start');
});

test('reviewError: upgrade, limit, invalid and failed read differently', () => {
  assert.equal(reviewError({ response: { status: 403, data: { code: 'upgrade_required' } } }).kind, 'upgrade');
  assert.equal(reviewError({ response: { status: 429, data: { message: 'Used up.' } } }).body, 'Used up.');
  assert.equal(reviewError({ response: { status: 400, data: {} } }).kind, 'invalid');
  assert.equal(reviewError({ response: { status: 422, data: { message: 'Try again.' } } }).body, 'Try again.');
  assert.equal(reviewError(new Error('network')).kind, 'failed');
});
