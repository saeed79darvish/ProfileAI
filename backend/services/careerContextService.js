/**
 * careerContextService — reading, merging and editing a CareerContext.
 *
 * Merging is how the coach writes: only fields it actually learned, never
 * overwriting what the person typed in themselves unless `overwrite` says
 * they are correcting it. Editing is how the person writes, from their
 * profile, and always wins.
 */

const { CAREER_STAGES, SENIORITY_IDS } = require('./jobSeniorityFit');
const { factById, storyById } = require('../config/answerCatalog');

const MAX_ANSWER_TEXT = 2000;
const MAX_FACT_NOTE = 500;

const badRequest = (message) => Object.assign(new Error(message), { status: 400, code: 'invalid_answer_memory' });

const plainText = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);

/**
 * Applies a partial edit to the answer memory. Pure: returns the next
 * { answerFacts, answerStories }, or throws a 400-tagged error.
 * `null` (or an empty value) deletes a key. updatedAt is stamped here.
 */
function mergeAnswerMemory(current = {}, patch = {}, now = new Date()) {
  const stamp = now.toISOString();
  const facts = { ...(current.answerFacts || {}) };
  const stories = { ...(current.answerStories || {}) };
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

  if (patch.answerFacts !== undefined) {
    if (!isObj(patch.answerFacts)) throw badRequest('answerFacts must be an object');
    for (const [id, raw] of Object.entries(patch.answerFacts)) {
      const fact = factById(id);
      if (!fact) throw badRequest(`Unknown fact: ${id}`);
      if (raw === null) { delete facts[id]; continue; }
      const entry = isObj(raw) ? raw : { value: raw };
      const value = plainText(entry.value, MAX_ANSWER_TEXT);
      if (!value) { delete facts[id]; continue; }
      if (fact.choices && !fact.choices.some((c) => c.value === value)) {
        throw badRequest(`Invalid value for ${id}`);
      }
      const note = plainText(entry.note, MAX_FACT_NOTE);
      facts[id] = { value, ...(note ? { note } : {}), updatedAt: stamp };
    }
  }

  if (patch.answerStories !== undefined) {
    if (!isObj(patch.answerStories)) throw badRequest('answerStories must be an object');
    for (const [id, raw] of Object.entries(patch.answerStories)) {
      if (!storyById(id)) throw badRequest(`Unknown story: ${id}`);
      if (raw === null) { delete stories[id]; continue; }
      const text = plainText(isObj(raw) ? raw.text : raw, MAX_ANSWER_TEXT);
      if (!text) { delete stories[id]; continue; }
      stories[id] = { text, updatedAt: stamp };
    }
  }
  return { answerFacts: facts, answerStories: stories };
}

const MAX_SUMMARIES = 20;
const MAX_TEXT = 1000;
const CONSTRAINT_KEYS = [
  'location', 'workStyle', 'roleTypes', 'salary', 'noticePeriod',
  'careerStage', 'seniority', 'sector',
];
const TEXT_KEYS = ['target', 'targetWhy', 'targetBlocker'];

/* The sector ids from frontend/src/data/jobTaxonomy.js JOB_SECTORS. Keep in
   sync when a sector is added there; an id missing here is dropped on save,
   which costs only the sector, never the rest of the write. */
const SECTOR_IDS = [
  'tech', 'data', 'design', 'product', 'marketing', 'sales', 'support', 'finance',
  'hr', 'admin', 'operations', 'healthcare', 'education', 'hospitality', 'trades',
  'media', 'legal', 'logistics', 'manufacturing', 'engineering', 'science',
  'socialcare', 'publicservice', 'realestate', 'agriculture', 'personal',
];

/* Keys whose value is one id from a fixed list. The jobs feed ranks on these
   (jobSeniorityFit reads careerStage and seniority), so a free-text value
   would silently do nothing; anything not on the list is dropped instead. */
const ENUM_KEYS = {
  careerStage: new Set(CAREER_STAGES),
  seniority: new Set(SENIORITY_IDS),
  sector: new Set(SECTOR_IDS),
};

const clean = (value, max = MAX_TEXT) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
};

const cleanConstraints = (raw = {}) => {
  const out = {};
  for (const key of CONSTRAINT_KEYS) {
    const value = raw?.[key];
    if (ENUM_KEYS[key]) {
      const id = clean(value, 40).toLowerCase();
      if (ENUM_KEYS[key].has(id)) out[key] = id;
      continue;
    }
    if (Array.isArray(value)) {
      const list = value.map((v) => clean(v, 60)).filter(Boolean).slice(0, 10);
      if (list.length) out[key] = list;
    } else if (clean(value, 200)) {
      out[key] = clean(value, 200);
    }
  }
  return out;
};

const cleanAssessment = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const list = (v) => (Array.isArray(v) ? v.slice(0, 8) : []);
  return {
    verdict: clean(raw.verdict, 40),
    headline: clean(raw.headline, 400),
    why: list(raw.why).map((w) => clean(w, 300)),
    closes: list(raw.closes).map((c) => ({ what: clean(c?.what, 300), effort: clean(c?.effort, 20) })),
  };
};

/** The shape the client sees. */
const toView = (row) => ({
  target: row?.target || '',
  targetWhy: row?.targetWhy || '',
  targetBlocker: row?.targetBlocker || '',
  constraints: row?.constraints || {},
  assessment: row?.assessment || null,
  summaries: row?.summaries || [],
  answerFacts: row?.answerFacts || {},
  answerStories: row?.answerStories || {},
  updatedAt: row?.updatedAt || null,
});

/** @param {{ CareerContext: import('sequelize').ModelStatic<any> }} deps */
function makeCareerContextService({ CareerContext }) {
  const load = async (userId) => {
    const [row] = await CareerContext.findOrCreate({ where: { userId }, defaults: { userId } });
    return row;
  };

  const get = async (userId) => toView(await CareerContext.findOne({ where: { userId } }));

  /**
   * The coach's write. Fills gaps by default; `overwrite` for a correction
   * the person made in the conversation.
   */
  const merge = async (userId, patch = {}, { overwrite = false } = {}) => {
    const row = await load(userId);
    const next = {};
    for (const key of TEXT_KEYS) {
      const value = clean(patch[key], key === 'target' ? 200 : MAX_TEXT);
      if (value && (overwrite || !row[key])) next[key] = value;
    }
    const constraints = cleanConstraints(patch.constraints);
    if (Object.keys(constraints).length) {
      next.constraints = overwrite
        ? { ...row.constraints, ...constraints }
        : { ...constraints, ...row.constraints };
    }
    const assessment = cleanAssessment(patch.assessment);
    if (assessment) next.assessment = assessment;
    const summary = clean(patch.summary, 1500);
    if (summary) {
      next.summaries = [...(row.summaries || []), {
        at: new Date().toISOString(),
        source: patch.summarySource === 'chat' ? 'chat' : 'call',
        text: summary,
      }].slice(-MAX_SUMMARIES);
    }
    if (Object.keys(next).length) await row.update(next);
    return toView(row);
  };

  /** The person's own edit from their profile: replaces what it names. */
  const edit = async (userId, patch = {}) => {
    const row = await load(userId);
    const next = {};
    for (const key of TEXT_KEYS) {
      if (key in patch) next[key] = clean(patch[key], key === 'target' ? 200 : MAX_TEXT) || null;
    }
    if (patch.constraints && typeof patch.constraints === 'object') {
      next.constraints = cleanConstraints(patch.constraints);
    }
    if (patch.answerFacts !== undefined || patch.answerStories !== undefined) {
      Object.assign(next, mergeAnswerMemory(row, patch));
    }
    if (Object.keys(next).length) await row.update(next);
    return toView(row);
  };

  /** Forget one thing: a field, the assessment, or one conversation summary. */
  const forget = async (userId, { field, summaryIndex } = {}) => {
    const row = await load(userId);
    if (TEXT_KEYS.includes(field)) await row.update({ [field]: null });
    else if (CONSTRAINT_KEYS.includes(field)) {
      const constraints = { ...(row.constraints || {}) };
      delete constraints[field];
      await row.update({ constraints });
    } else if (field === 'assessment') await row.update({ assessment: null });
    else if (Number.isInteger(summaryIndex)) {
      const summaries = [...(row.summaries || [])];
      summaries.splice(summaryIndex, 1);
      await row.update({ summaries });
    }
    return toView(row);
  };

  /** Forget everything. */
  const clear = async (userId) => {
    await CareerContext.destroy({ where: { userId } });
    return toView(null);
  };

  return { get, merge, edit, forget, clear };
}

module.exports = { makeCareerContextService, mergeAnswerMemory, toView, cleanConstraints, CONSTRAINT_KEYS, TEXT_KEYS, SECTOR_IDS };
