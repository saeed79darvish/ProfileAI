import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextIndexAfterFeedback, formatElapsed, spokenDuration, sessionErrorState, callErrorKind, errorCopy, pickTopQuestions, sessionBody,
  cleanNote, upsertNote, cleanFinish, noteChips, questionStates, buildSaveBody, hasSessionContent, storyForQuestion, practiceSummary, sessionsLabel,
} from './practiceLogic.js';

test('nextIndexAfterFeedback moves to N+1, never back, and stops one past the end', () => {
  assert.equal(nextIndexAfterFeedback(1, 1, 5), 2);
  assert.equal(nextIndexAfterFeedback(3, 1, 5), 3);
  assert.equal(nextIndexAfterFeedback(5, 5, 5), 6);
  assert.equal(nextIndexAfterFeedback(2, 9, 5), 6);
  assert.equal(nextIndexAfterFeedback(2, 'x', 5), 2);
  assert.equal(nextIndexAfterFeedback(undefined, 1, 5), 2);
});
test('formatElapsed and spokenDuration', () => {
  assert.equal(formatElapsed(48000), '0:48');
  assert.equal(formatElapsed(125000), '2:05');
  assert.equal(formatElapsed(-5), '0:00');
  assert.equal(formatElapsed(NaN), '0:00');
  assert.equal(spokenDuration(61), '1 minute 1 second');
  assert.equal(spokenDuration(120), '2 minutes');
  assert.equal(spokenDuration(1), '1 second');
});
test('sessionErrorState maps the contract errors', () => {
  const err = (status, data) => ({ response: { status, data } });
  assert.equal(sessionErrorState(err(403, { code: 'upgrade_required' })).kind, 'upgrade');
  assert.equal(sessionErrorState(err(429, { featureType: 'x', upgradeRequired: true })).kind, 'upgrade');
  assert.equal(sessionErrorState(err(429, { featureType: 'x', message: 'Used up' })).kind, 'limit');
  assert.equal(sessionErrorState(err(409, { code: 'not_ready' })).kind, 'not_ready');
  assert.equal(sessionErrorState(err(503, {})).kind, 'unavailable');
  assert.equal(sessionErrorState(err(500, { message: 'boom' })).message, 'boom');
  assert.equal(sessionErrorState(new Error('net')).kind, 'failed');
});
test('callErrorKind and errorCopy', () => {
  assert.equal(callErrorKind({ name: 'NotAllowedError' }), 'mic-denied');
  assert.equal(callErrorKind(new Error('handshake failed')), 'failed');
  assert.equal(errorCopy('upgrade').plans, true);
  assert.equal(errorCopy('unavailable').title, 'Voice is not available right now');
  assert.equal(errorCopy('whatever').title, 'We could not start the session');
});
test('pickTopQuestions takes the most reported, keeps order on ties, drops repeats', () => {
  const prep = { questions: [
    { text: 'A', sourceIds: ['1'] }, { text: 'B', sourceIds: ['1', '2', '3'] }, { text: 'C', sourceIds: ['1'] },
    { text: 'b', sourceIds: ['1'] }, { text: '' }, { text: 'D', sourceIds: [] }, { text: 'E' }, { text: 'F', sourceIds: ['1'] },
  ] };
  assert.deepEqual(pickTopQuestions(prep, 5).map((q) => q.text), ['B', 'A', 'C', 'F', 'D']);
  assert.equal(pickTopQuestions(prep, 2).length, 2);
  assert.deepEqual(pickTopQuestions(null), []);
  assert.equal(pickTopQuestions({ questions: [{ text: 'X', count: 4 }, { text: 'Y', count: 9 }] })[0].text, 'Y');
});
test('sessionBody sends questions only when there are some', () => {
  assert.deepEqual(sessionBody([]), {});
  assert.deepEqual(sessionBody([{ text: ' Q ', kind: 'weird' }]), { questions: [{ text: 'Q', kind: 'reported' }] });
});
test('cleanNote and upsertNote', () => {
  assert.equal(cleanNote({ questionIndex: 0 }), null);
  assert.equal(cleanNote(null), null);
  const n = cleanNote({ questionIndex: 2, question: ' Q ', worked: 'w', improve: 'i', usedStory: true });
  assert.deepEqual(n, { questionIndex: 2, question: 'Q', worked: 'w', improve: 'i', usedStory: true, hadNumbers: false });
  let notes = upsertNote([], n);
  notes = upsertNote(notes, cleanNote({ questionIndex: 1, question: 'A' }));
  notes = upsertNote(notes, { ...n, worked: 'again' });
  assert.deepEqual(notes.map((x) => [x.questionIndex, x.worked]), [[1, ''], [2, 'again']]);
  assert.deepEqual(upsertNote(notes, null), notes);
});
test('cleanFinish', () => {
  assert.deepEqual(cleanFinish({ summary: ' s ', topTip: 5 }), { summary: 's', topTip: '' });
  assert.deepEqual(cleanFinish(undefined), { summary: '', topTip: '' });
});
test('noteChips shows the story chip and the no numbers chip only when known', () => {
  assert.deepEqual(noteChips({ usedStory: true, hadNumbers: true }).map((c) => c.key), ['story']);
  assert.deepEqual(noteChips({ usedStory: false, hadNumbers: false }).map((c) => c.key), ['numbers']);
  assert.deepEqual(noteChips({ usedStory: true, hadNumbers: false }).map((c) => c.key), ['story', 'numbers']);
  assert.deepEqual(noteChips({}), []);
});
test('questionStates', () => {
  assert.deepEqual(questionStates(4, 2), ['done', 'current', 'upcoming', 'upcoming']);
  assert.deepEqual(questionStates(2, 3), ['done', 'done']);
  assert.deepEqual(questionStates(0, 1), []);
});
test('buildSaveBody', () => {
  const b = buildSaveBody({ startedAt: '2026-11-07T10:00:00Z', seconds: 61.6, notes: [{ questionIndex: 1, question: 'Q', worked: 'w', improve: 'i', usedStory: true, hadNumbers: false, extra: 1 }], summary: 's', topTip: 't' });
  assert.equal(b.startedAt, '2026-11-07T10:00:00.000Z');
  assert.equal(b.seconds, 62);
  assert.deepEqual(Object.keys(b.notes[0]), ['questionIndex', 'question', 'worked', 'improve', 'usedStory', 'hadNumbers']);
  assert.equal(buildSaveBody({ startedAt: 'bad', seconds: -1, notes: null }).seconds, 0);
});
test('hasSessionContent', () => {
  assert.equal(hasSessionContent([], null), false);
  assert.equal(hasSessionContent([{}], null), true);
  assert.equal(hasSessionContent([], { summary: 'x', topTip: '' }), true);
  assert.equal(hasSessionContent([], { summary: '', topTip: '' }), false);
});
test('storyForQuestion matches on theme words and gives up otherwise', () => {
  const stories = [{ id: 1, theme: 'Conflict with teammates', title: 'Billing components' }, { id: 2, theme: 'Leadership', title: 'x' }];
  assert.equal(storyForQuestion('Describe a conflict with a manager', stories).id, 1);
  assert.equal(storyForQuestion('Tell me about your leadership style', stories).id, 2);
  assert.equal(storyForQuestion('Design a feed', stories), null);
  assert.equal(storyForQuestion('', stories), null);
  assert.equal(storyForQuestion('Anything', null), null);
});
test('practiceSummary picks the latest session', () => {
  assert.deepEqual(practiceSummary([]), { count: 0, line: '' });
  const r = practiceSummary([{ startedAt: '2026-11-01T00:00:00Z', summary: 'old' }, { startedAt: '2026-11-05T00:00:00Z', summary: 'new' }]);
  assert.deepEqual(r, { count: 2, line: 'new' });
  assert.equal(sessionsLabel(1), '1 session');
  assert.equal(sessionsLabel(3), '3 sessions');
});
