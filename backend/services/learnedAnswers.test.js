const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeKey, jaccard, upsertLearned, editLearned, valueFromAnswer, MAX_ITEMS,
} = require('./learnedAnswers');
const { answerQuestions } = require('./answerMemoryService');
const { makeCareerContextService } = require('./careerContextService');

const noModel = async () => { throw new Error('open-ended model must not run'); };
const learnedFrom = (...pairs) => pairs.reduce((items, [question, answer, extra]) => (
  upsertLearned(items, { question, answer, ...(extra || {}) }).items
), []);

test('normalizeKey lowercases, strips punctuation and filler words, sorts tokens', () => {
  assert.equal(normalizeKey('Are you open to Relocation?'), 'open relocation');
  assert.equal(normalizeKey('Open to relocation'), 'open relocation');
  assert.equal(normalizeKey('Do you require the visa sponsorship for this job?'), 'job require sponsorship visa');
});

test('near-identical questions match deterministically without the model', async () => {
  const learned = learnedFrom(['Are you open to relocation?', 'Yes', { company: 'Acme' }]);
  let called = false;
  const r = await answerQuestions({
    questions: ['Are you open to relocation'], questionMeta: [{ fieldType: 'radio', options: ['Yes', 'No'] }],
    memory: { learnedAnswers: learned }, runModel: noModel,
    runLearnedMatch: async () => { called = true; return null; },
  });
  assert.equal(called, false);
  const d = r.details['Are you open to relocation'];
  assert.equal(d.source, 'learned');
  assert.equal(d.answer, 'Yes');
  assert.equal(d.learnedFrom.company, 'Acme');
  assert.equal(d.learnedFrom.question, 'Are you open to relocation?');
  assert.equal(r.modelCalled, false);
  assert.deepEqual(r.learnedUsed, [learned[0].id]);
});

test('a reworded question uses the model stage and accepts only when both flags are true', async () => {
  const learned = learnedFrom(['Are you willing to relocate for this position?', 'Yes']);
  const q = 'Would you be willing to relocate to another city?';
  const ask = (verdict) => answerQuestions({
    questions: [q], questionMeta: [{ fieldType: 'select', options: ['Yes', 'No'] }],
    memory: { learnedAnswers: learned }, runModel: async () => ({}),
    runLearnedMatch: async ({ candidates }) => { assert.equal(candidates[0].answer, 'Yes'); return verdict; },
  });
  // key overlap is below the deterministic threshold, so only the model can bridge it
  assert.ok(jaccard(normalizeKey(q), learned[0].key) < 0.8);
  const ok = await ask({ match: 0, same_concept: true, same_polarity: true });
  assert.equal(ok.details[q].source, 'learned');
  assert.equal(ok.details[q].answer, 'Yes');
});

test('polarity guard: a learned visa sponsorship answer never answers a work authorization question', async () => {
  const learned = learnedFrom(['Do you require visa sponsorship?', 'No']);
  const q = 'Are you authorized to work in the US?';
  // Different catalog facts: blocked before any model call.
  let called = false;
  const r = await answerQuestions({
    questions: [q], questionMeta: [{ fieldType: 'radio', options: ['Yes', 'No'] }],
    memory: { learnedAnswers: learned }, runModel: async () => ({}),
    runLearnedMatch: async () => { called = true; return { match: 0, same_concept: true, same_polarity: true }; },
  });
  assert.equal(called, false);
  assert.notEqual(r.details[q].source, 'learned');
  // A model that flags opposite polarity is also refused.
  const q2 = 'Are you eligible for employment without sponsorship at this company?';
  const learned2 = learnedFrom(['Are you eligible to hire without sponsorship needs?', 'No', {}]);
  const r2 = await answerQuestions({
    questions: ['Is employment here possible without sponsorship?'], questionMeta: [{ fieldType: 'radio', options: ['Yes', 'No'] }],
    memory: { learnedAnswers: learned2 }, runModel: async () => ({}),
    runLearnedMatch: async () => ({ match: 0, same_concept: true, same_polarity: false }),
  });
  assert.ok(q2);
  assert.notEqual(r2.details['Is employment here possible without sponsorship?'].source, 'learned');
});

test('sensitive questions are not stored and never answered from learned', async () => {
  const res = upsertLearned([], { question: 'What is your gender?', answer: 'Male' });
  assert.equal(res.skipped, 'sensitive');
  assert.equal(res.item, undefined);
  const forged = [{ id: 'x', question: 'What is your gender?', key: normalizeKey('What is your gender?'), answer: 'Male', kind: 'text', uses: 0 }];
  const r = await answerQuestions({
    questions: ['What is your gender?'], questionMeta: [{ fieldType: 'select', options: ['Male', 'Female'] }],
    memory: { learnedAnswers: forged }, runModel: noModel,
  });
  assert.equal(r.details['What is your gender?'].source, 'needs_you');
});

test('an answer over 500 characters is rejected with a 400', () => {
  assert.throws(() => upsertLearned([], { question: 'Tell us more', answer: 'x'.repeat(501) }), (e) => e.status === 400);
  assert.throws(() => upsertLearned([], { question: '', answer: 'x' }), (e) => e.status === 400);
});

test('learned answers are mapped to the exact option text, or needs_you with a suggestion', async () => {
  const learned = learnedFrom(['Preferred pronouns for email signature?', 'x']);
  assert.equal(learned.length, 0); // sensitive, skipped
  const l = learnedFrom(['Are you open to relocation?', 'Yes'], ['Which programming language do you prefer?', 'Python']);
  const mem = { learnedAnswers: l };
  const r = await answerQuestions({
    questions: ['Are you open to relocation?', 'Which programming language do you prefer?'],
    questionMeta: [
      { fieldType: 'radio', options: ['Yes, I am open to relocating', 'No, not at this time'] },
      { fieldType: 'select', options: ['Go', 'Rust'] },
    ],
    memory: mem, runModel: noModel,
  });
  assert.equal(r.details['Are you open to relocation?'].answer, 'Yes, I am open to relocating');
  const miss = r.details['Which programming language do you prefer?'];
  assert.equal(miss.source, 'needs_you');
  assert.equal(miss.suggestion, 'Python');
  assert.equal(miss.answer, '');
  assert.deepEqual(r.learnedUsed, [l.find((i) => i.answer === 'Yes').id]);
});

test('textarea fields never take a learned answer', async () => {
  const l = learnedFrom(['Why do you want to work here?', 'Because']);
  const r = await answerQuestions({
    questions: ['Why do you want to work here?'], questionMeta: [{ fieldType: 'textarea' }],
    memory: { learnedAnswers: l }, runModel: async () => ({ 'Why do you want to work here?': 'AI text' }),
  });
  assert.equal(r.details['Why do you want to work here?'].source, 'ai');
});

test('facts win over learned answers', async () => {
  const l = learnedFrom(['Are you open to relocation?', 'No']);
  const r = await answerQuestions({
    questions: ['Are you open to relocation?'], questionMeta: [{ fieldType: 'radio', options: ['Yes', 'No'] }],
    memory: { learnedAnswers: l, answerFacts: { openToRelocation: { value: 'yes' } } }, runModel: noModel,
  });
  const d = r.details['Are you open to relocation?'];
  assert.equal(d.source, 'fact');
  assert.equal(d.answer, 'Yes');
  assert.deepEqual(r.learnedUsed, []);
});

test('a learned answer fills a catalog fact question that has no stored fact', async () => {
  const l = learnedFrom(['Are you willing to relocate for work?', 'No']);
  const r = await answerQuestions({
    questions: ['Are you willing to relocate?'], questionMeta: [{ fieldType: 'radio', options: ['Yes', 'No'] }],
    memory: { learnedAnswers: l }, runModel: noModel,
    runLearnedMatch: async () => ({ match: 0, same_concept: true, same_polarity: true }),
  });
  const d = r.details['Are you willing to relocate?'];
  assert.equal(d.source, 'learned');
  assert.equal(d.answer, 'No');
  assert.equal(d.choiceValue, 'no');
});

test('an unsure model answer returns needs_you', async () => {
  const l = learnedFrom(['Would you move to another city for this job?', 'Yes']);
  const q = 'Can you consider a different location for this position?';
  for (const verdict of [null, { match: null, same_concept: false, same_polarity: false },
    { match: 0, same_concept: true, same_polarity: false }, { match: 7, same_concept: true, same_polarity: true }]) {
    const r = await answerQuestions({
      questions: [q], questionMeta: [{ fieldType: 'radio', options: ['Yes', 'No'] }],
      memory: { learnedAnswers: l }, runModel: async () => ({}),
      runLearnedMatch: async () => verdict,
    });
    assert.notEqual(r.details[q].source, 'learned');
  }
  const r = await answerQuestions({
    questions: ['Are you open to relocation?'], questionMeta: [{ fieldType: 'radio', options: ['Yes', 'No'] }],
    memory: { learnedAnswers: [] }, runModel: noModel,
  });
  assert.equal(r.details['Are you open to relocation?'].source, 'needs_you');
});

test('different numbers never match deterministically', async () => {
  const l = learnedFrom(['Are you open to working in-person 25% of the time?', 'Yes']);
  const r = await answerQuestions({
    questions: ['Are you open to working in-person 50% of the time?'], questionMeta: [{ fieldType: 'radio', options: ['Yes', 'No'] }],
    memory: { learnedAnswers: l }, runModel: noModel,
  });
  assert.notEqual(r.details['Are you open to working in-person 50% of the time?'].source, 'learned');
});

test('upsert replaces by key, keeps newest first and caps the list', () => {
  const t1 = new Date('2026-01-01T00:00:00Z');
  const t2 = new Date('2026-01-02T00:00:00Z');
  const first = upsertLearned([], { question: 'Favourite colour?', answer: 'Blue' }, t1);
  const again = upsertLearned(first.items, { question: 'favourite colour', answer: 'Green' }, t2);
  assert.equal(again.items.length, 1);
  assert.equal(again.item.id, first.item.id);
  assert.equal(again.item.answer, 'Green');
  assert.equal(again.item.createdAt, t1.toISOString());
  assert.equal(again.item.updatedAt, t2.toISOString());

  let items = [];
  for (let i = 0; i < MAX_ITEMS + 5; i += 1) {
    items = upsertLearned(items, { question: `Unique question number ${i}x${i}`, answer: 'a' }).items;
  }
  assert.equal(items.length, MAX_ITEMS);
  assert.ok(items[0].question.includes(String(MAX_ITEMS + 4)));
});

test('upsert records the catalog fact and value, edit updates the value', () => {
  const r = upsertLearned([], { question: 'Are you open to relocation?', answer: 'Yes', options: ['Yes', 'No'] });
  assert.equal(r.item.factId, 'openToRelocation');
  assert.equal(r.item.choiceValue, 'yes');
  assert.equal(r.item.kind, 'choice');
  const e = editLearned(r.items, r.item.id, 'No');
  assert.equal(e.item.choiceValue, 'no');
  assert.equal(editLearned(r.items, 'missing', 'No'), null);
  assert.equal(valueFromAnswer('workAuthorization', 'Yes', 'Are you authorized to work?'), 'authorized_no_sponsorship');
  assert.equal(valueFromAnswer('workAuthorization', 'No', 'Are you authorized to work?'), null);
  assert.equal(valueFromAnswer('noticePeriod', 'Two weeks'), null);
});

test('the service writes catalog facts alongside learned answers and clears with the record', async () => {
  const rows = new Map();
  const CareerContext = {
    findOrCreate: async ({ where }) => {
      if (!rows.has(where.userId)) {
        const row = { userId: where.userId, answerFacts: {}, answerStories: {}, learnedAnswers: [],
          update: async (patch) => { Object.assign(row, patch); return row; } };
        rows.set(where.userId, row);
      }
      return [rows.get(where.userId), true];
    },
    findOne: async ({ where }) => rows.get(where.userId) || null,
    destroy: async ({ where }) => { rows.delete(where.userId); },
  };
  const svc = makeCareerContextService({ CareerContext });
  const saved = await svc.upsertLearned('u1', { question: 'Are you open to relocation?', answer: 'Yes' });
  assert.equal(rows.get('u1').answerFacts.openToRelocation.value, 'yes');
  assert.equal((await svc.listLearned('u1')).length, 1);
  assert.deepEqual(await svc.upsertLearned('u1', { question: 'Race', answer: 'x' }), { skipped: 'sensitive' });
  await svc.bumpLearned('u1', [saved.item.id]);
  assert.equal(rows.get('u1').learnedAnswers[0].uses, 1);
  assert.equal(await svc.removeLearned('u1', saved.item.id), true);
  await svc.upsertLearned('u1', { question: 'Anything', answer: 'x' });
  await svc.clear('u1');
  assert.deepEqual(await svc.listLearned('u1'), []);
});
