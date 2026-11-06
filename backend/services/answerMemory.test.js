const test = require('node:test');
const assert = require('node:assert/strict');

const {
  detectFact, mapFactToOption, deriveFacts, publicCatalog,
} = require('../config/answerCatalog');
const { mergeAnswerMemory, makeCareerContextService } = require('./careerContextService');
const {
  answerQuestions, cleanBullets, matchRole, mergeBullets, parseModelJson,
} = require('./answerMemoryService');

/* ---------- detectFact ---------- */

test('detectFact finds the fact a question asks for', () => {
  assert.equal(detectFact('Will you now or in the future require sponsorship for employment visa status?'), 'sponsorshipFuture');
  assert.equal(detectFact('Do you require visa sponsorship?'), 'sponsorshipNow');
  assert.equal(detectFact('Are you legally authorized to work in the United States?'), 'workAuthorization');
  assert.equal(detectFact('Are you open to working in-person 25% of the time?'), 'officeComfort');
  assert.equal(detectFact('What is your NOTICE PERIOD?'), 'noticePeriod');
  assert.equal(detectFact('When can you start?'), 'earliestStart');
  assert.equal(detectFact('What are your salary expectations?'), 'salaryExpectation');
  assert.equal(detectFact('Are you willing to relocate?'), 'openToRelocation');
  assert.equal(detectFact('How did you hear about us?'), 'howHeard');
  assert.equal(detectFact('Describe a hard bug you fixed'), null);
});

test('detectFact flags sensitive questions and never maps them to a fact', () => {
  for (const q of [
    'What is your gender?', 'Race / Ethnicity', 'Are you Hispanic or Latino?', 'Veteran status',
    'Do you have a disability?', 'What is your age?', 'Have you been convicted of a felony?',
    'Religion', 'Sexual orientation',
  ]) {
    assert.deepEqual(detectFact(q), { sensitive: true }, q);
  }
});

test('the catalog exposes facts with detect patterns and stories without them', () => {
  const c = publicCatalog();
  assert.equal(c.facts.length, 10);
  assert.ok(c.facts.every((f) => Array.isArray(f.detect) && f.ask && f.label));
  assert.deepEqual(c.stories.map((s) => s.id), [
    'motivation', 'idealRole', 'careerGoals', 'proudestAchievement', 'uniqueStrength', 'workStyle', 'idealTeam', 'dealBreakers',
  ]);
});

/* ---------- mapFactToOption ---------- */

test('mapFactToOption maps sponsorship to Greenhouse style options', () => {
  assert.equal(mapFactToOption('sponsorshipNow', 'no', ['Yes', 'No']), 'No');
  assert.equal(mapFactToOption('sponsorshipNow', 'yes', ['Yes', 'No']), 'Yes');
  assert.equal(mapFactToOption('sponsorshipNow', 'no', ['Yes, I will require sponsorship', 'No, I will not']), 'No, I will not');
  assert.equal(mapFactToOption('sponsorshipNow', 'yes', ['Yes, I will require sponsorship', 'No, I will not']), 'Yes, I will require sponsorship');
  assert.equal(mapFactToOption('sponsorshipFuture', 'no', ['Yes, I will need sponsorship', 'I do not require sponsorship']), 'I do not require sponsorship');
});

test('mapFactToOption maps office comfort for a partial in-person ask', () => {
  const q = 'Are you open to working in-person 25% of the time?';
  assert.equal(mapFactToOption('officeComfort', 'hybrid_ok', ['Yes', 'No'], q), 'Yes');
  assert.equal(mapFactToOption('officeComfort', 'remote_only', ['Yes', 'No'], q), 'No');
  // Hybrid is not enough for a fully on-site ask: the person decides.
  assert.equal(mapFactToOption('officeComfort', 'hybrid_ok', ['Yes', 'No'], 'Can you work 100% on-site?'), null);
  assert.equal(mapFactToOption('officeComfort', 'hybrid_ok', ['Remote', 'Hybrid', 'On-site']), 'Hybrid');
});

test('mapFactToOption maps authorization and relocation, and gives up when nothing fits', () => {
  assert.equal(mapFactToOption('workAuthorization', 'authorized_no_sponsorship', ['Yes', 'No']), 'Yes');
  assert.equal(mapFactToOption('workAuthorization', 'needs_sponsorship_now', ['Yes', 'No']), null);
  assert.equal(mapFactToOption('openToRelocation', 'depends', ['Yes', 'No']), null);
  assert.equal(mapFactToOption('openToRelocation', 'no', ['Yes', 'No']), 'No');
  assert.equal(mapFactToOption('noticePeriod', '2 weeks', ['Immediately', '2 weeks', '1 month']), '2 weeks');
  assert.equal(mapFactToOption('noticePeriod', '2 weeks', ['Immediately', '1 month']), null);
  assert.equal(mapFactToOption('howHeard', 'A friend', ['LinkedIn', 'Other']), 'Other');
  assert.equal(mapFactToOption('sponsorshipNow', 'no', []), null);
  assert.equal(mapFactToOption('sponsorshipNow', 'no', ['Maybe', 'Unsure']), null);
});

/* ---------- deriveFacts ---------- */

test('deriveFacts implies both sponsorship facts from work authorization', () => {
  const a = deriveFacts({ answerFacts: { workAuthorization: { value: 'authorized_no_sponsorship' } } });
  assert.equal(a.sponsorshipNow.value, 'no');
  assert.equal(a.sponsorshipFuture.value, 'no');
  const b = deriveFacts({ answerFacts: { workAuthorization: { value: 'needs_sponsorship_future' } } });
  assert.equal(b.sponsorshipNow.value, 'no');
  assert.equal(b.sponsorshipFuture.value, 'yes');
  const c = deriveFacts({ answerFacts: { workAuthorization: { value: 'needs_sponsorship_now' } } });
  assert.equal(c.sponsorshipNow.value, 'yes');
});

test('a fact the person set directly wins over a derived one', () => {
  const f = deriveFacts({ answerFacts: {
    workAuthorization: { value: 'authorized_no_sponsorship' },
    sponsorshipFuture: { value: 'yes' },
  } });
  assert.equal(f.sponsorshipFuture.value, 'yes');
  assert.deepEqual(deriveFacts(null), {});
});

/* ---------- PATCH validation ---------- */

const NOW = new Date('2026-11-06T10:00:00Z');

test('mergeAnswerMemory merges, stamps updatedAt and deletes on null', () => {
  const first = mergeAnswerMemory({}, {
    answerFacts: { noticePeriod: { value: '  2 weeks ' }, officeComfort: { value: 'hybrid_ok', note: 'Tue and Thu' } },
    answerStories: { motivation: { text: 'I like fixing things' } },
  }, NOW);
  assert.equal(first.answerFacts.noticePeriod.value, '2 weeks');
  assert.equal(first.answerFacts.noticePeriod.updatedAt, NOW.toISOString());
  assert.equal(first.answerFacts.officeComfort.note, 'Tue and Thu');
  assert.equal(first.answerStories.motivation.updatedAt, NOW.toISOString());

  const second = mergeAnswerMemory(first, { answerFacts: { noticePeriod: null }, answerStories: { motivation: null } }, NOW);
  assert.equal('noticePeriod' in second.answerFacts, false);
  assert.ok(second.answerFacts.officeComfort);
  assert.deepEqual(second.answerStories, {});
});

test('mergeAnswerMemory rejects unknown ids, bad choices and bad shapes with a 400', () => {
  const bad = (patch) => assert.throws(() => mergeAnswerMemory({}, patch, NOW), (e) => e.status === 400);
  bad({ answerFacts: { favouriteColour: { value: 'blue' } } });
  bad({ answerFacts: { sponsorshipNow: { value: 'maybe' } } });
  bad({ answerFacts: { workAuthorization: { value: 'citizen' } } });
  bad({ answerStories: { nope: { text: 'x' } } });
  bad({ answerFacts: [] });
  bad({ answerStories: 'text' });
});

test('mergeAnswerMemory caps text length', () => {
  const out = mergeAnswerMemory({}, { answerStories: { motivation: { text: 'a'.repeat(5000) } } }, NOW);
  assert.equal(out.answerStories.motivation.text.length, 2000);
});

test('the service saves answer memory on edit and shows it on read', async () => {
  const rows = new Map();
  const row = { userId: 'u1', constraints: {}, summaries: [], update: async (p) => Object.assign(row, p) };
  rows.set('u1', row);
  const service = makeCareerContextService({ CareerContext: {
    findOrCreate: async () => [row], findOne: async () => row, destroy: async () => rows.delete('u1'),
  } });
  const out = await service.edit('u1', { answerFacts: { sponsorshipNow: { value: 'no' } } });
  assert.equal(out.answerFacts.sponsorshipNow.value, 'no');
  assert.deepEqual((await service.get('u1')).answerStories, {});
  const cleared = await service.clear('u1');
  assert.deepEqual(cleared.answerFacts, {});
  assert.deepEqual(cleared.answerStories, {});
});

/* ---------- generate-answers fact path ---------- */

const memory = {
  answerFacts: {
    workAuthorization: { value: 'authorized_no_sponsorship' },
    officeComfort: { value: 'hybrid_ok' },
  },
  answerStories: { motivation: { text: 'I like building tools people use daily.' } },
};

test('fact questions are answered without calling the model', async () => {
  let called = 0;
  const out = await answerQuestions({
    questions: ['Will you now or in the future require sponsorship?', 'Are you open to working in-person 25% of the time?'],
    questionMeta: [{ fieldType: 'select', options: ['Yes', 'No'] }, { fieldType: 'radio', options: ['Yes', 'No'] }],
    memory,
    runModel: async () => { called += 1; return {}; },
  });
  assert.equal(called, 0);
  assert.equal(out.modelCalled, false);
  assert.equal(out.answers['Will you now or in the future require sponsorship?'], 'No');
  assert.equal(out.answers['Are you open to working in-person 25% of the time?'], 'Yes');
  assert.equal(out.details['Will you now or in the future require sponsorship?'].source, 'fact');
  assert.equal(out.details['Will you now or in the future require sponsorship?'].factId, 'sponsorshipFuture');
});

test('unknown facts come back as needs_you with the question to ask', async () => {
  const out = await answerQuestions({
    questions: ['What is your notice period?'], memory, runModel: async () => { throw new Error('no model'); },
  });
  const d = out.details['What is your notice period?'];
  assert.equal(d.source, 'needs_you');
  assert.equal(d.answer, '');
  assert.equal(d.needsFact.id, 'noticePeriod');
  assert.equal(d.needsFact.type, 'text');
  assert.deepEqual(out.answers, {});
});

test('sensitive questions are never answered and never reach the model', async () => {
  let seen = [];
  const out = await answerQuestions({
    questions: ['What is your gender?', 'Veteran status', 'Why do you want to work here?'],
    questionMeta: [{ fieldType: 'select', options: ['Male', 'Female'] }, {}, { fieldType: 'textarea' }],
    memory,
    runModel: async ({ items }) => {
      seen = items.map((i) => i.question);
      return { 'Why do you want to work here?': 'Because I build tools.' };
    },
  });
  assert.deepEqual(seen, ['Why do you want to work here?']);
  assert.equal(out.details['What is your gender?'].source, 'needs_you');
  assert.equal(out.details['What is your gender?'].needsFact, undefined);
  assert.equal(out.details['Veteran status'].answer, '');
  assert.equal('What is your gender?' in out.answers, false);
});

test('open-ended answers carry the story source and a word count', async () => {
  let ctx = '';
  const out = await answerQuestions({
    questions: ['What motivates you?'],
    questionMeta: [{ fieldType: 'textarea' }],
    memory,
    runModel: async ({ storyContext }) => { ctx = storyContext; return { 'What motivates you?': 'I build tools people use daily.' }; },
  });
  assert.match(ctx, /tools people use daily/);
  const d = out.details['What motivates you?'];
  assert.equal(d.source, 'story');
  assert.equal(d.wordCount, 6);
});

test('optional catch-alls stay empty unless a story matches', async () => {
  let called = 0;
  const out = await answerQuestions({
    questions: ['Additional information'], questionMeta: [{ fieldType: 'textarea', optional: true }],
    memory: { answerFacts: {}, answerStories: {} },
    runModel: async () => { called += 1; return {}; },
  });
  assert.equal(called, 0);
  assert.deepEqual(out.answers, {});
});

test('a known fact that no option fits is left to the person', async () => {
  const out = await answerQuestions({
    questions: ['Are you legally authorized to work in the US?'],
    questionMeta: [{ fieldType: 'select', options: ['Maybe', 'Unsure'] }],
    memory, runModel: async () => ({}),
  });
  assert.equal(out.details['Are you legally authorized to work in the US?'].source, 'needs_you');
});

test('parseModelJson repairs a truncated reply instead of throwing', () => {
  assert.deepEqual(parseModelJson('```json\n{"a": "b"}\n```'), { a: 'b' });
  const cut = parseModelJson('{"a": "done", "b": "unfinished sent');
  assert.equal(cut.a, 'done');
});

/* ---------- experience from speech ---------- */

test('cleanBullets keeps 1 to 3 plain bullets with no dashes or markdown', () => {
  const out = cleanBullets([
    '• Built dashboards in **Grafana** for the SRE team',
    '- Reduced alert noise — by tuning thresholds',
    '2. Migrated services - from Java 8 to 17',
    'Extra fourth bullet',
    'Built dashboards in Grafana for the SRE team',
  ]);
  assert.equal(out.length, 3);
  assert.ok(out.every((b) => !/[•\-–—*`#]/.test(b.replace(/(\w)-(\w)/g, '$1$2'))));
  assert.equal(out[0], 'Built dashboards in Grafana for the SRE team');
  assert.equal(out[1], 'Reduced alert noise, by tuning thresholds');
  assert.deepEqual(cleanBullets('  '), []);
});

const roles = [
  { title: 'Site Reliability Engineer', company: 'Equinix' },
  { title: 'Backend Developer', company: 'Acme Corp' },
];

test('matchRole picks the role named by company or title, else asks', () => {
  assert.equal(matchRole('At Equinix I built Grafana dashboards', '', roles).roleIndex, 0);
  assert.equal(matchRole('I built things', 'Acme', roles).roleIndex, 1);
  assert.equal(matchRole('as a backend developer I wrote Java', '', roles).roleIndex, 1);
  const none = matchRole('I built Grafana dashboards', '', roles);
  assert.equal(none.roleIndex, null);
  assert.equal(none.roleCandidates.length, 2);
  assert.deepEqual(none.roleCandidates[0], { index: 0, title: 'Site Reliability Engineer', company: 'Equinix' });
  assert.equal(matchRole('anything', '', []).roleIndex, null);
});

test('mergeBullets appends bullet lines and dedupes against what is there', () => {
  const { description, added } = mergeBullets('• Built dashboards in Grafana\n• Ran on call', [
    'built dashboards in grafana.', 'Migrated Java services', '  ', '• Ran on call',
  ]);
  assert.deepEqual(added, ['• Migrated Java services']);
  assert.equal(description, '• Built dashboards in Grafana\n• Ran on call\n• Migrated Java services');
  assert.equal(mergeBullets('', ['One']).description, '• One');
});

test('a single question still gets its answer when the model rewords the key', async () => {
  const { answerQuestions } = require('./answerMemoryService');
  const r = await answerQuestions({
    questions: ['Why Anthropic?*\n\n(Work in this detail: I built Grafana dashboards.)'],
    questionMeta: [{ fieldType: 'textarea' }],
    memory: { answerFacts: {}, answerStories: {} },
    runModel: async () => ({ 'Why Anthropic?*': 'Because of the mission, and my Grafana work.' }),
  });
  const d = Object.values(r.details)[0];
  require('node:assert').strictEqual(d.source, 'ai');
  require('node:assert').match(d.answer, /Grafana/);
});
