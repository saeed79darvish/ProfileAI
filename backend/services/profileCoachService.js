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
  reviewProfilePrompt,
  targetAssessmentPrompt,
  answerAsidePrompt,
  coachTurnPrompt,
  fixPlanPrompt,
} = require('./ai/prompts/profileCoach');
const { inspectProfile } = require('./resume/coachInspect');
const { countOpenings } = require('./coachMarket');

// Free-text answers are short and the extraction target is tiny, so Haiku
// is the right tier here — a conversation is ~10 of these calls and using
// Sonnet would make the builder cost more than parsing a whole resume.
const TURN_MODEL = HAIKU_MODEL;
const { gapCheckPrompt, suggestPrompt, SUGGEST_KINDS } = require('./ai/prompts/coachStage');

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
  // For the people whose work does not live at an employer: students, new
  // grads, bootcamp leavers, career changers, and anyone who skipped the
  // role questions. Without this the coach hands them a profile with an
  // empty experience section — which is the one section recruiters read.
  //
  // `technologies` is deliberately broad. A nurse's project used a triage
  // protocol, an electrician's used conduit and a permit; insisting on
  // software tooling here is how a builder tells half its users it was not
  // written for them.
  projects: {
    question: 'Tell me about something you built, ran or organised.',
    expects: {
      // Not `name`: the clarify prompt is handed the missing field keys, so a
      // field called "name" asked "What's your name?" — which anyone would
      // answer with their own. The key is part of the question the person
      // reads, whether or not we meant it to be.
      projectName: 'what the project is called',
      description: 'what it was and what they did on it, one or two sentences in their own words',
      technologies: 'array of tools, materials, systems or methods they used',
      url: 'link to it, if they gave one',
      role: 'their role on it, if they said',
    },
    // A project with no name is not a row anyone can render. Everything else
    // can be filled in later in the editor.
    required: ['projectName'],
  },
  // The coach's own follow-up questions after reading a resume ("what reports
  // do you build, and who reads them?"). Deliberately loose: a good probe
  // answer is a story, and what we want out of it is whatever it evidences —
  // work worth a bullet, tools worth listing, or both.
  probe: {
    question: 'Tell me more about that.',
    expects: {
      bullets: 'array of resume bullet points describing concrete work they did, in their own words',
      skills: 'array of tools, systems or software they named',
    },
    required: [],
  },
  lookingFor: {
    question: 'What kind of role are you looking for?',
    expects: {
      roleType: 'employment type: Full-time, Part-time, Contract, Freelance or Internship',
      workStyle: 'Remote, Hybrid or On-site',
    },
    required: [],
  },
  /* One answer, everything in it.
   *
   * Every other schema here is deliberately narrow — one question, one or two
   * fields — which is right when the coach asked one question. It is wrong
   * for prose. Someone who says "I'm a software engineer, ten years, last
   * five at Acme on payments, Node and Postgres, team of six" at the title
   * question has their title extracted and the rest of it thrown away, then
   * gets asked for each discarded part over the next six questions.
   *
   * This is the schema for a paragraph: typed, dictated, or the transcript of
   * a voice call. Whatever it finds, the conversation then skips asking for.
   *
   * Everything is optional on purpose. Half the point is handling an answer
   * that covers three fields and says nothing about the other six — a missing
   * key means "they did not say", which the coach then asks about, and that
   * is a better outcome than a confident guess sitting in someone's resume.
   */
  braindump: {
    question: 'Tell me about your work — whatever comes to mind.',
    expects: {
      title: 'their current or most recent job title',
      seniority: 'how senior they are, in their own words: junior, mid, senior, staff, principal, lead, manager, director, apprentice, newly qualified',
      field: 'the field or industry they work in',
      company: 'the employer of their most recent role',
      startDate: 'when that role started, YYYY-MM or YYYY',
      endDate: 'when it ended, YYYY-MM or YYYY, or "Present" if still there',
      bullets: 'array of concrete things they said they did or built, each one a resume bullet in their own words',
      skills: 'array of tools, systems, languages, methods or certifications they named',
      previousCompany: 'an earlier employer, if they mentioned one',
      school: 'school, university or bootcamp',
      degree: 'degree or credential',
      location: 'where they are based',
      yearsExperience: 'total years of experience, as a number, only if they stated it',
    },
    // Nothing is required: a paragraph that mentions only skills is still
    // worth keeping every skill from.
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

/* ================================================================
   The coaching pass — review, and the target assessment
   ================================================================ */

/** Keep a model-returned list of strings sane before it reaches the UI. */
function stringList(value, max) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim())
    .slice(0, max);
}

/**
 * reviewProfile — the coach reads a resume and says what it sees.
 *
 * The defects are counted first by inspectProfile and handed to the model to
 * explain, so every criticism traces to something actually in the document.
 * The raw inspection travels back with the response: the client uses the same
 * findings to decide what to ask about next, and the counts drive the
 * readiness meter, so there is one source for both.
 *
 * Runs on the default (Sonnet) tier. This is the moment the product either
 * feels like a career coach or like a spellchecker, and it happens once.
 *
 * @returns {Promise<{opening: string, working: string[], fix: object[], probes: string[], inspection: object}>}
 */
async function reviewProfile({ profile, sector } = {}) {
  const inspection = inspectProfile(profile || {});

  const response = await callAI({
    max_tokens: 2400,
    temperature: 0.4,
    messages: [{
      role: 'user',
      content: reviewProfilePrompt({ profile: profile || {}, inspection, sector }),
    }],
  });

  /* A reply cut off by the token cap used to parse as nothing, and the
     person got "Got it." over an empty card right after uploading their
     resume. Repair what came back before giving up on it. */
  const raw = response.choices[0].message.content || '';
  let parsed = safeParseJSON(raw);
  if (!parsed) {
    try {
      // Lazy: the parser service is heavy and only needed on this path.
      // eslint-disable-next-line global-require
      const { repairTruncatedJSON } = require('./resumeParserService');
      const start = raw.indexOf('{');
      parsed = start >= 0 ? repairTruncatedJSON(raw.slice(start)) : null;
      if (parsed) console.warn('[coach] review JSON was truncated; recovered');
    } catch (error) {
      console.error('[coach] review JSON could not be recovered:', error.message);
    }
  }
  parsed = parsed || {};

  const fix = Array.isArray(parsed.fix)
    ? parsed.fix
      .filter((f) => f && typeof f === 'object' && typeof f.what === 'string' && f.what.trim())
      .map((f) => ({
        what: String(f.what).trim(),
        why: typeof f.why === 'string' ? f.why.trim() : '',
        how: typeof f.how === 'string' ? f.how.trim() : '',
      }))
      .slice(0, 5)
    : [];

  return {
    opening: typeof parsed.opening === 'string' ? parsed.opening.trim() : '',
    working: stringList(parsed.working, 3),
    fix,
    probes: stringList(parsed.probes, 3),
    // Counted, not judged — the client renders these directly.
    inspection,
  };
}

/**
 * coachTurn — one turn of the conversation, decided by the model.
 *
 * The model is handed the profile so far, what it still needs, and the
 * transcript, and returns what to say plus whatever the person just revealed.
 * The checklist stays ours: the model never decides what a profile requires,
 * only how to ask for the next missing piece and how to respond to whatever
 * came back — including when what came back is a question, a greeting, a
 * correction, or three answers at once.
 *
 * `learned` is filtered to the keys we know how to store. A model that
 * invents a field name should write nothing, not write anywhere.
 */
const TURN_FIELDS = new Set([
  'title', 'seniority', 'field', 'company', 'startDate', 'endDate', 'bullets',
  'skills', 'previousCompany', 'school', 'degree', 'location', 'roleType',
  'workStyle', 'target', 'yearsExperience', 'graduationYear', 'project',
]);

/* A project they described: something built or run outside a job. Kept to
   the fields the profile has, as strings. */
const cleanProject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const text = (v, max) => String(typeof v === 'string' ? v : '').replace(/\s+/g, ' ').trim().slice(0, max);
  const name = text(value.name, 120);
  if (!name) return null;
  return {
    name,
    description: text(value.description, 1200),
    url: text(value.url, 300),
    technologies: (Array.isArray(value.technologies) ? value.technologies : [])
      .map((t) => text(t, 40)).filter(Boolean).slice(0, 12),
  };
};

/* Suggested answers the model wrote for the question it asked: short,
   distinct, a few at most. Anything else in the array is dropped. */
const MAX_SUGGESTIONS = 6;
const cleanSuggestions = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const text = String(typeof item === 'string' ? item : '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 60 || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
};

async function coachTurn({ profile = {}, missing = [], history = [], message, liveVoice = 'none', asked = '', options = [], next = null, followUps = 0 } = {}) {
  const trimmed = String(message || '').trim().slice(0, MAX_ANSWER_CHARS);
  if (!trimmed) return { say: '', learned: {}, awaiting: true, voice: false, show: 'none', suggestions: [] };

  const response = await callAI({
    model: TURN_MODEL,
    // Room for the suggested answers on top of the reply.
    max_tokens: 900,
    temperature: 0.5,
    messages: [{
      role: 'user',
      content: coachTurnPrompt({
        profile,
        missing,
        /* Enough that the resume review, a call and the questions since are
           all in view: at ten, the coach asked again about things said a
           few minutes earlier. Each line is capped so a long one cannot
           crowd out the rest. */
        history: history.slice(-30).map((h) => ({ ...h, text: String(h?.text || '').slice(0, 600) })),
        message: trimmed,
        liveVoice,
        asked,
        options,
        next,
        followUps,
      }),
    }],
  });

  const parsed = safeParseJSON(response.choices[0].message.content) || {};

  const learned = {};
  for (const [key, value] of Object.entries(parsed.learned || {})) {
    if (!TURN_FIELDS.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    if (key === 'project') {
      const project = cleanProject(value);
      if (project) learned.project = project;
      continue;
    }
    learned[key] = value;
  }

  let say = String(parsed.say || '').trim();
  /* One follow-up per question, enforced. The prompt asks for it, and a
     new grad who answered "not sure" was still asked the same thing thirty
     times in a row. Past the first, a question is dropped and the page
     moves on. */
  if (followUps >= 1 && say.includes('?')) say = '';
  let awaiting = parsed.awaiting !== false && !!say;
  /* A re-ask is not always a question: "Walk me through your most recent
     job" has no question mark and was asked four times. Past the first
     follow-up, anything still waiting on them is dropped. */
  if (followUps >= 1 && awaiting) {
    say = '';
    awaiting = false;
  }

  return {
    say,
    learned,
    // Default to waiting. Pressing on when the model did not say it was
    // finished is how a conversation talks over someone.
    awaiting,
    suggestions: awaiting ? cleanSuggestions(parsed.suggestions) : [],
    skip: parsed.skip === true && !awaiting,
    answered: parsed.answered === true && !awaiting,
    // Only ever true when the page said it can open a call right now.
    voice: liveVoice === 'live' && parsed.voice === true,
    // A piece of the page to put under the reply. Only names we render.
    show: parsed.show === 'import' ? 'import' : 'none',
    // Only a button that is actually on their screen.
    choice: options.find((o) => o.toLowerCase() === String(parsed.choice || '').trim().toLowerCase()) || '',
  };
}

/**
 * answerAside — reply to a question someone asked mid-conversation.
 *
 * Costs one small call, only ever on something the person typed themselves,
 * and changes no profile field: an aside is not an answer.
 */
async function answerAside({ question, asked, context = {} } = {}) {
  const trimmed = String(question || '').trim().slice(0, MAX_ANSWER_CHARS);
  if (!trimmed) return '';

  const response = await callAI({
    model: TURN_MODEL,
    max_tokens: 220,
    temperature: 0.5,
    messages: [{
      role: 'user',
      content: answerAsidePrompt({ question: trimmed, asked, context }),
    }],
  });

  return (response.choices[0].message.content || '').trim();
}

/**
 * assessTarget — how far the target role is, and what closes the gap.
 *
 * The opening counts come from our own job corpus rather than the model, so
 * the number quoted matches what the candidate will find when they go looking.
 * A failed or empty market lookup degrades to nulls, which the prompt is
 * explicitly told never to read as "no jobs exist".
 *
 * @returns {Promise<{verdict: string, headline: string, why: string[], closes: object[], market: object}>}
 */
async function assessTarget({ profile, target, location, workStyle, motivation, blocker } = {}) {
  const inspection = inspectProfile(profile || {});

  let market = { total: null, nearby: null, nearbyKind: null, terms: [], samples: [] };
  try {
    market = await countOpenings({ title: target, location, workStyle });
  } catch (err) {
    // A market number is a bonus, not a prerequisite — never fail the
    // assessment because a count query did.
    console.error('[coach] market lookup failed:', err.message);
  }

  const response = await callAI({
    max_tokens: 1200,
    temperature: 0.4,
    messages: [{
      role: 'user',
      content: targetAssessmentPrompt({
        profile: profile || {}, inspection, target, market, motivation, blocker,
      }),
    }],
  });

  const parsed = safeParseJSON(response.choices[0].message.content) || {};

  const VERDICTS = new Set(['within reach', 'a stretch', 'a big jump']);
  const verdict = VERDICTS.has(parsed.verdict) ? parsed.verdict : 'a stretch';

  const closes = Array.isArray(parsed.closes)
    ? parsed.closes
      .filter((c) => c && typeof c === 'object' && typeof c.what === 'string' && c.what.trim())
      .map((c) => ({
        what: String(c.what).trim(),
        effort: ['quick', 'weeks', 'months'].includes(c.effort) ? c.effort : 'weeks',
      }))
      .slice(0, 4)
    : [];

  return {
    verdict,
    headline: typeof parsed.headline === 'string' ? parsed.headline.trim() : '',
    why: stringList(parsed.why, 3),
    closes,
    market,
  };
}

/**
 * planFixes — the review's advice written out as new text: headline,
 * summary, bullets for the roles that need them, and skills their own
 * experience shows. Each piece is checked against the profile it came from,
 * so a role index that does not exist or a skill they already list is
 * dropped rather than shown.
 */
const clip = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
async function planFixes({ profile = {}, review = null, target = '', motivation = '', assessment = null } = {}) {
  const response = await callAI({
    max_tokens: 2400,
    temperature: 0.3,
    messages: [{ role: 'user', content: fixPlanPrompt({ profile, review, target, motivation, assessment }) }],
  });
  const raw = response.choices[0].message.content || '';
  let parsed = safeParseJSON(raw);
  if (!parsed) {
    // eslint-disable-next-line global-require
    const { repairTruncatedJSON } = require('./resumeParserService');
    const start = raw.indexOf('{');
    try { parsed = start >= 0 ? repairTruncatedJSON(raw.slice(start)) : null; } catch { parsed = null; }
  }
  parsed = parsed || {};

  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const have = new Set((profile.skills || []).map((s) => String(s?.name || s).toLowerCase().trim()));
  const sameText = (a, b) => clip(a, 2000).toLowerCase() === clip(b, 2000).toLowerCase();

  const headline = clip(parsed.headline, 90);
  const summary = clip(parsed.summary, 700);
  const seen = new Set();
  const roles = (Array.isArray(parsed.roles) ? parsed.roles : [])
    .filter((r) => r && Number.isInteger(r.index) && r.index >= 0 && r.index < Math.min(3, experience.length) && !seen.has(r.index) && seen.add(r.index))
    .map((r) => ({
      index: r.index,
      title: experience[r.index].title || '',
      company: experience[r.index].company || '',
      bullets: (Array.isArray(r.bullets) ? r.bullets : []).map((b) => clip(b, 260)).filter(Boolean).slice(0, 6),
    }))
    .filter((r) => r.bullets.length);
  const skills = [...new Set((Array.isArray(parsed.skills) ? parsed.skills : [])
    .map((s) => clip(s, 40)).filter((s) => s && !have.has(s.toLowerCase())))].slice(0, 8);

  return {
    headline: headline && !sameText(headline, profile.title) ? headline : '',
    summary: summary && !sameText(summary, profile.summary) ? summary : '',
    roles,
    skills,
  };
}

/* Questions, cleaned: strings, one short sentence each, at most `max`. */
const cleanLines = (value, { max, maxLength }) => (Array.isArray(value) ? value : [])
  .map((q) => String(typeof q === 'string' ? q : '').replace(/\s+/g, ' ').trim())
  .filter((q) => q && q.length <= maxLength)
  .filter((q, i, all) => all.findIndex((o) => o.toLowerCase() === q.toLowerCase()) === i)
  .slice(0, max);

/**
 * gapCheck — read the finished draft once, against who they are and where
 * they are heading, and ask for what a recruiter would miss. Up to two
 * questions; none when it is ready.
 */
async function gapCheck({ profile = {} } = {}) {
  const response = await callAI({
    model: TURN_MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: gapCheckPrompt({ profile }) }],
  });
  const parsed = safeParseJSON(response.choices[0].message.content) || {};
  return cleanLines(parsed.questions, { max: 2, maxLength: 220 });
}

/**
 * suggestAnswers — the buttons under a question about titles, the target
 * role or skills, written for this person rather than for their field.
 */
async function suggestAnswers({ profile = {}, kind = 'titles', question = '', said = [] } = {}) {
  if (!SUGGEST_KINDS[kind]) return [];
  const response = await callAI({
    model: TURN_MODEL,
    max_tokens: 300,
    messages: [{ role: 'user', content: suggestPrompt({ profile, kind, question, said }) }],
  });
  const parsed = safeParseJSON(response.choices[0].message.content) || {};
  return cleanLines(parsed.suggestions, { max: 6, maxLength: 40 });
}

module.exports = {
  gapCheck,
  suggestAnswers,
  planFixes,
  STEP_SCHEMAS,
  reviewProfile,
  assessTarget,
  answerAside,
  coachTurn,
  PLACEHOLDER_RE,
  interpretAnswer,
  writeBullets,
  writeSummary,
  // exported for unit tests
  pickExpected,
  MAX_ANSWER_CHARS,
};
