/**
 * careerContextService — reading, merging and editing a CareerContext.
 *
 * Merging is how the coach writes: only fields it actually learned, never
 * overwriting what the person typed in themselves unless `overwrite` says
 * they are correcting it. Editing is how the person writes, from their
 * profile, and always wins.
 */

const MAX_SUMMARIES = 20;
const MAX_TEXT = 1000;
const CONSTRAINT_KEYS = ['location', 'workStyle', 'roleTypes', 'salary', 'noticePeriod'];
const TEXT_KEYS = ['target', 'targetWhy', 'targetBlocker'];

const clean = (value, max = MAX_TEXT) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
};

const cleanConstraints = (raw = {}) => {
  const out = {};
  for (const key of CONSTRAINT_KEYS) {
    const value = raw[key];
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

module.exports = { makeCareerContextService, toView, cleanConstraints, CONSTRAINT_KEYS, TEXT_KEYS };
