/**
 * profileCoachService — the AI half of the conversational profile builder.
 *
 * Division of labour (see prompts/profileCoach.js for the why):
 *   client  → owns the question ladder, chip answers, and draft state
 *   service → interprets free-text answers, writes bullets and the summary
 *
 * Every function here is stateless: the client sends the draft, we send
 * back field updates. No conversation rows in Postgres, which is what lets
 * the same flow work for a signed-out visitor whose draft lives in
 * localStorage (see frontend/src/utils/guestDraft.js).
 */
const { callAI, safeParseJSON, HAIKU_MODEL } = require('./ai/core');
const {
  interpretAnswerPrompt,
  clarifyPrompt,
  writeBulletsPrompt,
  writeSummaryPrompt,
} = require('./ai/prompts/profileCoach');

// Free-text answers are short and the extraction target is tiny, so Haiku
// is the right tier here — a conversation is ~10 of these calls and using
// Sonnet would make the builder cost more than parsing a whole resume.
const TURN_MODEL = HAIKU_MODEL;

// Hard cap on what we'll accept as one chat answer. Voice transcripts run
// long, but anything past this is a paste, not an answer, and would blow
// the token budget for a single turn.
const MAX_ANSWER_CHARS = 2000;

/**
 * STEP_SCHEMAS — what each free-text step is allowed to extract.
 *
 * These live on the server, not in the client's ladder, for one reason:
 * `expects` becomes part of the prompt. If the client sent it, this
 * endpoint would be a general-purpose LLM proxy on our Anthropic key that
 * anyone with a session could point at any task. Keyed by stepId, the
 * blast radius is "the model fills in resume fields", which is all it
 * should ever do.
 *
 * The client still owns question wording and chips — that's presentation,
 * and it changes far more often than these shapes do.
 */
const STEP_SCHEMAS = {
  title: {
    question: "What's your job title?",
    expects: { title: 'their job title, in their own words' },
    required: ['title'],
  },
  currentRole: {
    question: 'Where do you work, and how long have you been there?',
    expects: {
      title: 'job title at this employer',
      company: 'employer name',
      startDate: 'when they started, YYYY-MM or YYYY',
      endDate: 'when they left, YYYY-MM or YYYY, or "Present" if still there',
    },
    required: ['company'],
  },
  skills: {
    question: 'What are you actually good at?',
    expects: { skills: 'array of individual skill names they mentioned' },
    required: ['skills'],
  },
  education: {
    question: "What's your education?",
    expects: {
      school: 'school, university or bootcamp name',
      degree: 'degree or credential, e.g. BSc, Bootcamp Certificate',
      field: 'field of study',
      endDate: 'graduation year, YYYY',
    },
    // Degree is required, not optional: the completion rubric and the editor's
    // save path both need institution AND degree, so a row with only a school
    // is dropped on the floor later. Better to spend one follow-up asking.
    required: ['school', 'degree'],
  },
  location: {
    question: 'Where are you based?',
    expects: { location: 'city and country or region' },
    required: ['location'],
  },
  lookingFor: {
    question: 'What kind of role are you looking for?',
    expects: {
      roleType: 'employment type: Full-time, Part-time, Contract, Freelance or Internship',
      workStyle: 'Remote, Hybrid or On-site',
    },
    required: [],
  },
};

// Values that are the *name* of the thing rather than the thing. Models
// reliably do this when someone's phrasing echoes the field ("a supply chain
// degree" → degree: "degree"). It matters more than it looks: the profile
// rubric and the editor's save path both treat these as empty, so a row built
// from one is silently dropped later. Mirrors PLACEHOLDER_RE in
// frontend/src/hooks/useProfileCompletion.js.
const PLACEHOLDER_RE = /^(field|degree|period|company\s*name|institution\s*name|school|role|title|location|skill|n\/?a|none|null|undefined|tbd|unknown)$/i;

/**
 * Strip anything the model returned that the step didn't ask for, and drop
 * empty values. Without this a chatty model can widen the draft with keys
 * the client's handoff mapping doesn't know about, which silently lands
 * junk in the editor.
 *
 * @param {object} raw      parsed model output
 * @param {object} expects  the step's declared field shape
 * @returns {object}        only the expected, non-empty keys
 */
function pickExpected(raw, expects) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const key of Object.keys(expects || {})) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || PLACEHOLDER_RE.test(trimmed)) continue;
      out[key] = trimmed;
      continue;
    }
    if (Array.isArray(value)) {
      const cleaned = value
        .filter((v) => typeof v === 'string' && v.trim() && !PLACEHOLDER_RE.test(v.trim()))
        .map((v) => v.trim());
      if (cleaned.length) out[key] = cleaned;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return out;
}

/**
 * interpretAnswer — parse one free-text answer into the fields a step wants.
 *
 * Returns the extracted fields plus, when the answer came up short, a single
 * follow-up question for the coach to ask. `missing` is derived from the
 * step's own `required` list rather than from everything it expects, so an
 * optional field the person didn't mention doesn't trigger a re-ask.
 *
 * @param {object} p
 * @param {string} p.stepId    key into STEP_SCHEMAS — decides what may be extracted
 * @param {string} [p.question] the wording the person actually saw
 * @param {string} p.answer
 * @param {object} [p.context]
 * @throws {Error} with code 'unknown_step' for an unrecognised stepId
 * @returns {Promise<{fields: object, followUp: string|null}>}
 */
async function interpretAnswer({ stepId, question, answer, context = {} }) {
  const schema = STEP_SCHEMAS[stepId];
  if (!schema) {
    const err = new Error(`unknown_step:${stepId}`);
    err.code = 'unknown_step';
    throw err;
  }
  const { expects, required } = schema;

  const trimmed = String(answer || '').trim().slice(0, MAX_ANSWER_CHARS);
  if (!trimmed) return { fields: {}, followUp: null };

  // The client's wording is what the person actually saw on screen, so it
  // gives the model better context than the canned text — but it's still
  // client input, so it's length-capped and falls back to ours.
  const asked = String(question || '').trim().slice(0, 200) || schema.question;

  const response = await callAI({
    model: TURN_MODEL,
    max_tokens: 500,
    temperature: 0,
    messages: [{
      role: 'user',
      content: interpretAnswerPrompt({ question: asked, expects, answer: trimmed, context }),
    }],
  });

  const parsed = safeParseJSON(response.choices[0].message.content);
  const fields = pickExpected(parsed, expects);

  const missing = required.filter((key) => !(key in fields));
  if (!missing.length) return { fields, followUp: null };

  // One clarification, never a loop. If the follow-up also comes back empty
  // the client moves on and leaves the field for the editor — being stuck in
  // a two-turn interrogation is worse than an incomplete draft.
  const followUpRes = await callAI({
    model: TURN_MODEL,
    max_tokens: 100,
    temperature: 0.4,
    messages: [{
      role: 'user',
      content: clarifyPrompt({ question: asked, answer: trimmed, missing }),
    }],
  });

  const followUp = (followUpRes.choices[0].message.content || '').trim();
  return { fields, followUp: followUp.includes('?') ? followUp : null };
}

/**
 * writeBullets — turn a freeform "what did you do there" answer into
 * resume bullets. Returns [] on anything unparseable so the caller can
 * fall back to storing the raw text as the description.
 *
 * @returns {Promise<string[]>}
 */
async function writeBullets({ title, company, rawAnswer }) {
  const trimmed = String(rawAnswer || '').trim().slice(0, MAX_ANSWER_CHARS);
  if (!trimmed) return [];

  const response = await callAI({
    model: TURN_MODEL,
    max_tokens: 600,
    temperature: 0.5,
    messages: [{
      role: 'user',
      content: writeBulletsPrompt({ title, company, rawAnswer: trimmed }),
    }],
  });

  const parsed = safeParseJSON(response.choices[0].message.content, [], 'array');
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((b) => typeof b === 'string' && b.trim())
    .map((b) => b.trim())
    .slice(0, 4);
}

/**
 * writeSummary — the profile summary, generated once at the end of the
 * conversation from the assembled draft.
 *
 * @returns {Promise<string>} empty string if the model returns nothing usable
 */
async function writeSummary(draft) {
  const response = await callAI({
    // Summary is the one piece of prose a recruiter actually reads, and it's
    // written once per profile — worth the default (Sonnet) tier.
    max_tokens: 400,
    temperature: 0.6,
    messages: [{ role: 'user', content: writeSummaryPrompt(draft || {}) }],
  });

  return (response.choices[0].message.content || '').trim();
}

module.exports = {
  STEP_SCHEMAS,
  PLACEHOLDER_RE,
  interpretAnswer,
  writeBullets,
  writeSummary,
  // exported for unit tests
  pickExpected,
  MAX_ANSWER_CHARS,
};
