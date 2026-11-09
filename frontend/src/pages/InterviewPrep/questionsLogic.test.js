import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questionType, allQuestions, reportedByType, reportedCounts, defaultTypeTab, questionMeta, practiceRoute, savedNotes, probeCards, suggestedCards, areasOf, inArea } from './questionsLogic.js';

const prep = { questions: [
  { id: 'q1', text: 'How do you prevent unnecessary re-renders in large React applications?', category: 'coding', mostRecent: '2026-10-05T00:00:00Z', sourceIds: ['s1'] },
  { id: 'q2', text: 'Implement a debounce function', category: 'coding', mostRecent: '2026-09-01T00:00:00Z', sourceIds: ['s1', 's2'] },
  { id: 'q3', text: 'What is lazy loading and how does it improve application performance?', category: 'role_specific', mostRecent: null, sourceIds: ['s1', 's2'] },
  { id: 'q4', text: 'Tell me about a time you disagreed with a teammate', category: 'behavioral', mostRecent: '2026-10-20T00:00:00Z', sourceIds: ['s3'] },
  { id: 'q5', text: 'System design questions for full stack roles', category: 'system_design', mostRecent: '2026-10-25T00:00:00Z', sourceIds: ['s1'] },
  { id: 'q6', text: 'Design a news feed for millions of users', category: 'other', mostRecent: null, sourceIds: ['s1'] },
  { id: 'q7', text: 'How would you handle slow API responses in your frontend?', category: 'system_design', mostRecent: null, sourceIds: ['s1', 's2'] },
] };

test('questionType: behavioral and design stand apart, everything else is technical', () => {
  assert.equal(questionType({ text: 'Tell me about a conflict', category: 'behavioral' }), 'behavioral');
  assert.equal(questionType({ text: 'How would you handle slow API responses?', category: 'system_design' }), 'system_design');
  assert.equal(questionType({ text: 'Design a news feed for millions of users', category: 'other' }), 'system_design');
  assert.equal(questionType({ text: 'How would you architect a CDN for assets?', category: 'role_specific' }), 'system_design');
  assert.equal(questionType({ text: 'Implement a debounce function', category: 'coding' }), 'technical');
  assert.equal(questionType({ text: 'What is the virtual DOM?', category: 'role_specific' }), 'technical');
});

test('allQuestions drops headings and tags each one', () => {
  const list = allQuestions(prep);
  assert.equal(list.length, 6);
  assert.equal(list.find((q) => q.id === 'q2').kind, 'code');
  assert.equal(list.find((q) => q.id === 'q6').type, 'system_design');
});

test('reportedByType: newest first when anything has a date, else most reported first; says which', () => {
  const tech = reportedByType(prep, 'technical');
  assert.equal(tech.order, 'newest');
  assert.deepEqual(tech.list.map((q) => q.id), ['q1', 'q2', 'q3']);
  const sd = reportedByType(prep, 'system_design');
  assert.equal(sd.order, 'most');
  assert.deepEqual(sd.list.map((q) => q.id), ['q7', 'q6']);
  assert.deepEqual(reportedByType(prep, 'behavioral').list.map((q) => q.id), ['q4']);
  assert.deepEqual(reportedByType(null, 'behavioral'), { list: [], order: 'most' });
});

test('reportedCounts and defaultTypeTab', () => {
  assert.deepEqual(reportedCounts(prep), { behavioral: 1, technical: 3, system_design: 2 });
  assert.equal(defaultTypeTab(prep), 'technical');
  assert.equal(defaultTypeTab({ questions: [] }), 'technical');
  assert.equal(defaultTypeTab({ questions: [{ id: 'a', text: 'Tell me about a time you led a team?', category: 'behavioral', sourceIds: [] }] }), 'behavioral');
});

test('questionMeta: date and sources, or sources alone', () => {
  assert.equal(questionMeta({ mostRecent: '2026-10-05T00:00:00Z', sourceIds: ['a'] }), 'Reported Oct 2026 · 1 source');
  assert.equal(questionMeta({ sourceIds: ['a', 'b'] }), '2 sources');
});

test('suggested questions: cleaned, grouped by area, filterable', () => {
  const cards = suggestedCards([
    { id: 'sg-1', text: ' What is a closure? ', area: 'JavaScript', kind: 'spoken' },
    { id: 'sg-2', text: 'Implement a debounce function', area: 'JavaScript', kind: 'code' },
    { id: 'sg-3', text: 'What is the virtual DOM?', area: '', kind: 'weird' },
    { id: '', text: 'no id' }, { id: 'sg-5', text: '' }, null,
  ]);
  assert.equal(cards.length, 3);
  assert.equal(cards[2].area, 'General');
  assert.equal(cards[2].kind, 'spoken');
  assert.deepEqual(areasOf(cards), ['JavaScript', 'General']);
  assert.deepEqual(inArea(cards, 'JavaScript').map((q) => q.id), ['sg-1', 'sg-2']);
  assert.equal(inArea(cards, '').length, 3);
  assert.deepEqual(areasOf(null), []);
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
