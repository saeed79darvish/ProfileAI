import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recentQuestions, commonQuestions, defaultTab, tabCounts, questionMeta, practiceRoute, savedNotes, probeCards, allQuestions } from './questionsLogic.js';

const prep = { questions: [
  { id: 'q1', text: 'How do you prevent unnecessary re-renders in large React applications?', category: 'coding', mostRecent: '2026-10-05T00:00:00Z', sourceIds: ['s1'] },
  { id: 'q2', text: 'Implement a debounce function', category: 'coding', mostRecent: '2026-09-01T00:00:00Z', sourceIds: ['s1', 's2'] },
  { id: 'q3', text: 'What is lazy loading and how does it improve application performance?', category: 'role_specific', mostRecent: null, sourceIds: ['s1', 's2'] },
  { id: 'q4', text: 'Tell me about a time you disagreed with a teammate', category: 'behavioral', mostRecent: '2026-10-20T00:00:00Z', sourceIds: ['s3'] },
  { id: 'q5', text: 'System design questions for full stack roles', category: 'system_design', mostRecent: '2026-10-25T00:00:00Z', sourceIds: ['s1'] },
] };

test('allQuestions drops headings and tags each one', () => {
  const list = allQuestions(prep);
  assert.equal(list.length, 4);
  assert.equal(list.find((q) => q.id === 'q2').kind, 'code');
  assert.equal(list.find((q) => q.id === 'q1').kind, 'spoken');
});

test('recent: dated only, newest first, filterable', () => {
  assert.deepEqual(recentQuestions(prep).map((q) => q.id), ['q4', 'q1', 'q2']);
  assert.deepEqual(recentQuestions(prep, 'code').map((q) => q.id), ['q2']);
  assert.deepEqual(recentQuestions(prep, 'spoken').map((q) => q.id), ['q4', 'q1']);
});

test('common: most reported first, a matching question wins a tie, filterable', () => {
  assert.deepEqual(commonQuestions(prep).map((q) => q.id), ['q2', 'q3', 'q1', 'q4']);
  assert.deepEqual(commonQuestions(prep, { areas: ['performance'] }).map((q) => q.id), ['q3', 'q2', 'q1', 'q4']);
  assert.deepEqual(commonQuestions(prep, null, 'code').map((q) => q.id), ['q2']);
});

test('defaultTab and tabCounts', () => {
  assert.equal(defaultTab(prep), 'recent');
  assert.equal(defaultTab({ questions: [{ id: 'a', text: 'What is lazy loading and why use it?', category: 'role_specific', sourceIds: [] }] }), 'common');
  assert.deepEqual(tabCounts(prep), { recent: 3, common: 4 });
  assert.deepEqual(tabCounts(null), { recent: 0, common: 0 });
});

test('questionMeta: date and sources, or sources alone', () => {
  assert.equal(questionMeta({ mostRecent: '2026-10-05T00:00:00Z', sourceIds: ['a'] }), 'Reported Oct 2026 · 1 source');
  assert.equal(questionMeta({ sourceIds: ['a', 'b'] }), '2 sources');
});

test('practiceRoute: code goes to the editor with the question, the rest to voice with only that question', () => {
  const c = practiceRoute('p1', { text: 'Implement a debounce function', kind: 'code' });
  assert.equal(c.path, '/interview-prep/code/p1?question=Implement%20a%20debounce%20function');
  const s = practiceRoute('p1', { text: 'What is the virtual DOM?', kind: 'spoken' });
  assert.equal(s.path, '/interview-prep/practice/p1');
  assert.deepEqual(s.state, { only: { text: 'What is the virtual DOM?', kind: 'reported' } });
  assert.equal(practiceRoute('p1', { text: 'Walk me through X', kind: 'spoken', fromResume: true }).state.only.kind, 'resume');
});

test('savedNotes and probeCards tolerate junk', () => {
  assert.deepEqual(savedNotes({ preparation: { q1: ['a point', '', 5] } }, 'q1'), ['a point']);
  assert.deepEqual(savedNotes({}, 'q1'), []);
  assert.deepEqual(savedNotes(null, 'q1'), []);
  const cards = probeCards([{ question: ' Walk us through the 30% gain ', why: 'w', basedOn: 'b' }, { question: '' }, null]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].text, 'Walk us through the 30% gain');
  assert.equal(cards[0].fromResume, true);
});
