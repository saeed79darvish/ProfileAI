const { test } = require('node:test');
const assert = require('node:assert/strict');

const { toAIProfile, loadCandidateProfile, hasProfileContent, AI_PROFILE_FIELDS } = require('./candidateProfile');
const { buildTailoringPrompt } = require('./tailoringPrompts');

const vector = () => Array.from({ length: 512 }, (_, i) => Number((Math.sin(i) / 10).toFixed(9)));

/** What the extension used to send: the raw /profiles/me row, verbatim. */
const RAW_ME_ROW = {
  id: 'p-1',
  userId: 'u-1',
  title: 'Senior Software Engineer',
  summary: 'Builds UI platforms.',
  skills: ['React', 'TypeScript'],
  experience: [{ company: 'Equinix', title: 'Architect', description: 'Built the component library' }],
  education: [{ institution: 'UCSC Silicon Valley Extension', degree: 'Certificate' }],
  location: 'San Francisco, CA',
  embedding: vector(),
  openaiEmbedding: vector(),
  embeddingUpdatedAt: '2026-10-01T00:00:00Z',
  originalResumeText: 'SAEED DARVISH ... the whole uploaded resume ...',
  aiSummary: 'Recruiter-side AI summary',
  aiKeywords: ['x'],
  importBatchId: 'b-9',
  createdAt: '2025-01-01',
};

test('the AI view of a profile carries no embedding vectors', () => {
  const ai = toAIProfile(RAW_ME_ROW);
  assert.ok(!('embedding' in ai));
  assert.ok(!('openaiEmbedding' in ai));
  assert.ok(!('embeddingUpdatedAt' in ai));
});

test('the AI view never carries the raw resume text or internal fields', () => {
  const ai = toAIProfile(RAW_ME_ROW);
  for (const field of ['originalResumeText', 'aiSummary', 'aiKeywords', 'id', 'userId', 'importBatchId', 'createdAt']) {
    assert.ok(!(field in ai), `${field} leaked into the AI view`);
  }
});

test('the AI view keeps every field a resume prompt needs', () => {
  const ai = toAIProfile(RAW_ME_ROW);
  assert.equal(ai.title, 'Senior Software Engineer');
  assert.deepEqual(ai.skills, ['React', 'TypeScript']);
  assert.equal(ai.experience[0].company, 'Equinix');
  assert.equal(ai.education[0].institution, 'UCSC Silicon Valley Extension');
  assert.equal(ai.location, 'San Francisco, CA');
});

test('the AI view is dramatically smaller than the raw row', () => {
  const raw = JSON.stringify(RAW_ME_ROW).length;
  const ai = JSON.stringify(toAIProfile(RAW_ME_ROW)).length;
  assert.ok(ai < raw / 10, `AI view ${ai} chars vs raw ${raw} — the vectors are still in it`);
});

test('a Sequelize-style row is unwrapped through toJSON', () => {
  const row = { toJSON: () => RAW_ME_ROW };
  assert.equal(toAIProfile(row).title, 'Senior Software Engineer');
  assert.ok(!('embedding' in toAIProfile(row)));
});

test('junk input yields an empty profile, not a throw', () => {
  assert.deepEqual(toAIProfile(null), {});
  assert.deepEqual(toAIProfile('nope'), {});
});

// ── Loading from the database ───────────────────────────────────────────────

const fakeModels = (row, user) => {
  const calls = [];
  return {
    calls,
    Profile: {
      findOne: async (opts) => { calls.push(opts); return row ? { toJSON: () => row } : null; },
    },
    User: { findByPk: async () => user },
  };
};

test('the server loads the profile itself and never asks for the vectors', async () => {
  const m = fakeModels(RAW_ME_ROW, { firstName: 'Saeed', lastName: 'Darvish' });
  const loaded = await loadCandidateProfile('u-1', m);

  assert.deepEqual(m.calls[0].where, { userId: 'u-1' });
  const attrs = m.calls[0].attributes;
  assert.ok(!attrs.includes('embedding') && !attrs.includes('openaiEmbedding'), 'the query still selects the vectors');
  assert.ok(attrs.includes('originalResumeText'));

  assert.equal(loaded.originalResumeText, RAW_ME_ROW.originalResumeText);
  assert.ok(!('originalResumeText' in loaded.profileData), 'resume text duplicated into prompt material');
  assert.equal(loaded.profileData.firstName, 'Saeed');
});

test('a user with no profile row gets null, not an empty profile', async () => {
  assert.equal(await loadCandidateProfile('u-1', fakeModels(null)), null);
});

test('hasProfileContent rejects an empty shell', () => {
  assert.equal(hasProfileContent({}), false);
  assert.equal(hasProfileContent({ experience: [] }), false);
  assert.equal(hasProfileContent({ summary: 'x' }), true);
  assert.equal(hasProfileContent({ experience: [{ company: 'A' }] }), true);
});

test('the whitelist names no field that could hold a vector', () => {
  for (const f of AI_PROFILE_FIELDS) assert.ok(!/embedding|vector/i.test(f), f);
});

// ── Prompts ─────────────────────────────────────────────────────────────────

test('a tailoring prompt built from a raw /me row contains no vector numbers', () => {
  const { prompt } = buildTailoringPrompt({
    group: 'engineering',
    originalResumeText: null, // PATH B: the profile itself is serialised
    profileData: RAW_ME_ROW,
    jobDescription: 'We need an engineer.',
    targetTitle: 'Staff Software Engineer',
    gapContext: '',
    settingsContext: '',
    extractedKeywords: { required: [] },
    expCount: 1,
  });
  assert.ok(!prompt.includes('openaiEmbedding'), 'embedding key reached the prompt');
  assert.ok(!prompt.includes(String(RAW_ME_ROW.embedding[3])), 'embedding values reached the prompt');
  assert.ok(prompt.includes('Equinix'), 'the actual profile was lost');
});
