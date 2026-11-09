const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('./interviewSuggestService');

test('jobSignal keeps only the job keywords and requirements, capped', () => {
  assert.deepEqual(s.jobSignal(null), { keywords: [], requirements: [] });
  const sig = s.jobSignal({ _jobKeywords: ['Next.js', 'TypeScript', 5, ''], requirementCoverage: [{ requirement: '2+ years of frontend work', status: 'demonstrated', evidence: 'private details about the person' }], summary: 'private' });
  assert.deepEqual(sig.keywords, ['Next.js', 'TypeScript', '5']);
  assert.deepEqual(sig.requirements, ['2+ years of frontend work']);
  assert.ok(!JSON.stringify(sig).includes('private'));
});

test('signalKey: same job, same key; no job, no key', () => {
  const a = s.signalKey({ keywords: ['React'], requirements: [] });
  assert.equal(a, s.signalKey({ keywords: ['React'], requirements: [] }));
  assert.notEqual(a, s.signalKey({ keywords: ['Vue'], requirements: [] }));
  assert.equal(s.signalKey(null), '');
  assert.equal(s.signalKey({ keywords: [], requirements: [] }), '');
  assert.equal(s.cacheKey('technical', null), 'technical|role');
  assert.equal(s.cacheKey('technical', { keywords: ['React'], requirements: [] }), `technical|${a}`);
});

test('cleanSuggested: real questions only, no repeats of what was reported, safe ids, kind only for technical', () => {
  const parsed = { questions: [
    { text: 'What is the virtual DOM and why does it help?', area: 'React', kind: 'spoken' },
    { text: 'Implement a debounce function', area: 'JavaScript', kind: 'code' },
    { text: 'React hooks', area: 'React' },
    { text: 'What is the virtual DOM and why does it help?', area: 'React' },
    { text: 'How does the event loop work? — in detail', area: 'JavaScript → core' },
    { text: 'Already reported question about lazy loading?', area: 'Performance' },
  ] };
  const out = s.cleanSuggested(parsed, { type: 'technical', key: 'abc123', existing: ['Already reported question about lazy loading?'] });
  assert.deepEqual(out.map((q) => q.kind), ['spoken', 'code', 'spoken']);
  assert.ok(out.every((q) => /^sg-technical-abc123-\d+$/.test(q.id)));
  assert.ok(out.every((q) => !/[—→]/.test(q.text + q.area)));
  const sd = s.cleanSuggested({ questions: [{ text: 'Design a news feed for millions of users?', area: 'Scale', kind: 'code' }] }, { type: 'system_design', key: '' });
  assert.equal(sd[0].kind, 'spoken');
  assert.equal(sd[0].id, 'sg-systemdesign-role-1');
  assert.deepEqual(s.cleanSuggested(null, { type: 'behavioral', key: '' }), []);
});

test('suggestQuestions: tells the model the role, the job and what was already reported; unknown kind or junk gives []', async () => {
  let seen;
  const out = await s.suggestQuestions({
    prep: { role: 'Staff Frontend Engineer', company: '', level: 'staff', questions: [{ text: 'Tell me about a conflict you resolved?' }] },
    type: 'behavioral', signal: { keywords: ['React'], requirements: ['5+ years frontend'] },
    runModel: async (a) => { seen = a; return '{"questions":[{"text":"Tell me about a time you led a migration across teams?","area":"Leadership"}]}'; },
  });
  assert.match(seen.prompt, /Staff Frontend Engineer, level: staff/);
  assert.match(seen.prompt, /across companies/);
  assert.match(seen.prompt, /React/);
  assert.match(seen.prompt, /5\+ years frontend/);
  assert.match(seen.prompt, /do not repeat/i);
  assert.equal(out.length, 1);
  assert.deepEqual(await s.suggestQuestions({ prep: {}, type: 'nope', runModel: async () => '{}' }), []);
  assert.deepEqual(await s.suggestQuestions({ prep: {}, type: 'technical', runModel: async () => 'garbage' }), []);
  assert.deepEqual(await s.suggestQuestions({ prep: {}, type: 'technical', runModel: async () => { throw new Error('down'); } }), []);
});

test('allSuggested flattens every stored list', () => {
  assert.deepEqual(s.allSuggested({ suggested: { 'a|role': [{ id: 'x1' }], 'b|role': [{ id: 'x2' }, null] } }).map((q) => q.id), ['x1', 'x2']);
  assert.deepEqual(s.allSuggested({}), []);
});
