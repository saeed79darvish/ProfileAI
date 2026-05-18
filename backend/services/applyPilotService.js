/**
 * ApplyPilot service — the business logic behind /api/applypilot/*.
 *
 * All LLM work goes through `callAI` in services/ai/core.js (which is
 * Anthropic Claude Sonnet), so if you need to change models you do it
 * in one place.
 *
 * This file owns four pure functions the routes and background workers
 * both call:
 *   - scoreJob       → 0-100 fit given a user profile + job posting
 *   - tailorResume   → diff-style rewrite of the user's resume for a JD
 *   - draftCoverAndAnswers → cover letter + form-field answers
 *   - interviewUser  → next coach question based on training memory
 *
 * The functions return plain JSON — the routes wrap them with
 * DB reads/writes and timestamps.
 */
const { callAI, safeParseJSON } = require('./ai/core');
const resumeParserService = require('./resumeParserService');
const { generateCoverLetterAndAnswers } = require('./coverLetterService');
const { FORM_TEMPLATES } = require('../config/applicationFormTemplates');

/**
 * Build a default set of formFields for prep when the source job didn't
 * include any (true for most scouted postings — fields are only known
 * after the ATS form is actually crawled at submit time).
 *
 * We hand the AI the STANDARD template's short-answer questions only
 * (no file uploads, no list/section types) so it can pre-draft something
 * useful for the human to review.
 */
function defaultFormFields() {
  const tpl = FORM_TEMPLATES.STANDARD;
  if (!tpl || !Array.isArray(tpl.questions)) return [];
  const SKIP_TYPES = new Set(['file', 'experience_list', 'education_list']);
  return tpl.questions
    .filter((q) => !SKIP_TYPES.has(q.type))
    .map((q) => ({
      fieldId: q.id,
      question: q.question,
      type: q.type,
      required: !!q.required,
      options: q.options || undefined,
    }));
}
const {
  ApplyPilotConfig,
  ApplyPilotApplication,
  ApplyPilotTrainingMemory,
  ApplyPilotTrainingMessage,
  Profile,
  Job,
  ExternalJob,
  TailoredProfile,
  User,
} = require('../models');

/* ================================================================
   LLM calls
   ================================================================ */

/**
 * scoreJob — returns { match: 0-100, haveSkills, missingSkills, rationale }.
 * Uses Claude with JSON-only instruction. Fast and cheap — called on
 * every scouted job.
 */
async function scoreJob({ profile, job }) {
  const profileSummary = summarizeProfileForPrompt(profile);
  const jobText = summarizeJobForPrompt(job);

  const prompt = `You are a hiring-fit scorer. Compare the candidate profile with the job description and return JSON only, no prose.

CANDIDATE:
${profileSummary}

JOB:
${jobText}

Return JSON shaped exactly like:
{
  "match": 0-100 integer,
  "haveSkills": ["react","typescript",...],
  "missingSkills": ["graphql",...],
  "rationale": "One sentence explaining the score."
}`;

  const res = await callAI({
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 400,
    temperature: 0.2,
  });
  const raw = res.choices[0].message.content.trim();
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  const parsed = safeParseJSON(json || raw, {
    match: 0, haveSkills: [], missingSkills: [], rationale: '',
  });
  // Clamp defensively.
  parsed.match = Math.max(0, Math.min(100, parseInt(parsed.match, 10) || 0));
  return parsed;
}

/**
 * tailorResume — returns the Review page's diff structure PLUS the rich
 * tailored payload from the shared resumeParserService.
 *
 * Previously this ran its own ~20-line inline prompt. It now delegates
 * to `resumeParserService.tailorProfileForJob`, which is the same
 * department-aware pipeline the main Profile → Tailor flow uses
 * (keyword extraction → role-specific prompt → post-process keyword
 *  injection → ATS sanitization). Reusing it means:
 *   - One source of truth for tailoring quality across the app
 *   - Richer output (skillsGrouped, projects, changelog, matchAnalysis)
 *   - ApplyPilot inherits any future improvements to the shared prompt
 *
 * We still derive the legacy diff shape (summaryNew / experienceDiff /
 * added / newSkills / whyPicked) so ReviewPage and resumePdf keep working
 * without changes. The rich fields ride alongside them.
 */
async function tailorResume({ profile, job, memory, tailorSettings: userTailorSettings, gapSelections: userGapSelections } = {}) {
  const profileJson = profile ? (profile.toJSON ? profile.toJSON() : profile) : {};
  const jobJson = job ? (job.toJSON ? job.toJSON() : job) : {};

  const profileData = buildProfileDataForTailor(profileJson);
  const jobDescription = buildJobDescriptionForTailor(jobJson);
  const originalResumeText = profileJson.originalResumeText || null;

  // Sensible defaults so unattended ApplyPilot output reads as densely
  // as a hand-tuned Jobs-page tailoring. Anything the caller passes in
  // (e.g. user's last-used settings) wins.
  const tailorSettings = {
    tone: 'professional',
    summaryLines: 4,
    experienceLines: 5,
    maxSkills: 20,
    includeProjects: true,
    ...(userTailorSettings || {}),
  };

  // Gap selections come from one of two places:
  //   1. Caller passed them in (interactive flow: candidate just
  //      reviewed gaps in the GapReviewDialog and chose which to
  //      accept). We trust those and skip our own analysis.
  //   2. Caller didn't pass any — ApplyPilot is running unattended,
  //      so we run analyzeResumeGaps and auto-accept the
  //      critical/important ones to mirror what a human would pick.
  let gapSelections = userGapSelections && (
    Array.isArray(userGapSelections.acceptedGaps) || Array.isArray(userGapSelections.acceptedGapObjects)
  ) ? userGapSelections : null;
  if (!gapSelections) {
  try {
    const gapResult = await resumeParserService.analyzeResumeGaps(
      profileData,
      jobDescription,
      originalResumeText,
    );
    if (gapResult && gapResult.success && Array.isArray(gapResult.gaps)) {
      const importantGaps = gapResult.gaps.filter(
        g => g && (g.severity === 'critical' || g.severity === 'important') && (g.skill || g.keyword)
      );
      const acceptedGaps = importantGaps.map(g => g.skill || g.keyword).filter(Boolean);
      const acceptedGapObjects = importantGaps.map(g => ({
        skill: g.skill || g.keyword,
        type: g.type || (g.severity === 'critical' ? 'required' : 'nice_to_have'),
        reason: g.reason || g.evidence || '',
      }));
      if (acceptedGaps.length) {
        gapSelections = {
          acceptedGaps,
          acceptedGapObjects,
          skippedGaps: [],
        };
        console.log(`[applyPilot] Auto-accepted ${acceptedGaps.length} gaps:`, acceptedGaps);
      }
    }
  } catch (gapErr) {
    if (gapErr?.status === 529 || gapErr?.status === 503 || gapErr?.error?.type === 'overloaded_error') {
      throw gapErr;
    }
    console.warn('[applyPilot] analyzeResumeGaps failed, continuing without gap context:', gapErr.message);
  }
  }

  let rich = null;
  try {
    const result = await resumeParserService.tailorProfileForJob(
      profileData,
      jobDescription,
      originalResumeText,
      gapSelections,
      tailorSettings,
    );
    if (result && result.success) {
      rich = result.data;
    } else {
      console.warn('[applyPilot] tailorProfileForJob returned non-success:', result?.error);
    }
  } catch (err) {
    // Overloaded / transient errors bubble up so the route/worker can
    // re-queue; everything else falls through to a minimal diff so the
    // app doesn't get stuck in "preparing" forever.
    if (err?.status === 529 || err?.status === 503 || err?.error?.type === 'overloaded_error') {
      throw err;
    }
    console.warn('[applyPilot] tailorProfileForJob failed, emitting empty diff:', err.message);
  }

  // Build the legacy diff shape from either the rich payload or the
  // original profile as fallback.
  const diff = deriveDiffFromRich(profileJson, rich);

  // whyPicked: a one-liner the UI shows next to the job card. The rich
  // pipeline doesn't produce this, so we generate a tiny Claude snippet
  // (cheap) or fall back to matchAnalysis.
  const whyPicked = await buildWhyPicked({ profile: profileJson, job: jobJson, memory, rich, diff });

  return {
    // legacy diff shape — ReviewPage + resumePdf read these
    summaryOld: diff.summaryOld,
    summaryNew: diff.summaryNew,
    experienceDiff: diff.experienceDiff,
    added: diff.added,
    newSkills: diff.newSkills,
    whyPicked,
    // rich shape — new consumers should prefer these
    rich,
  };
}

/**
 * Build the `profileData` object that `tailorProfileForJob` expects.
 *
 * Mirrors the /jobs-page Tailoring panel (`JobAIToolsPanel.getProfileData`)
 * exactly so ApplyPilot reuses the same canonical inputs:
 *   - `title` MUST be present — `classifyDepartment()` reads it to pick
 *     the role-specific prompt block (engineering/design/marketing/...).
 *     Sending only `headline` would fall back to the engineering block
 *     for every candidate.
 *   - `skills` is passed through as-is. Profile.skills is a structured
 *     object ({core, soft, industry, software, technical}); coercing
 *     to `[]` (old behaviour) sent the AI an empty skill list.
 *   - Contact fields (email/phone/location/links/headline) ride along
 *     so the rendered resume still has a header.
 */
function buildProfileDataForTailor(profile) {
  const p = profile || {};
  return {
    // Same shape /jobs page sends — drives department classification +
    // ATS keyword matching.
    title: p.title || p.headline || '',
    summary: p.summary || '',
    skills: p.skills || [],
    experience: Array.isArray(p.experience) ? p.experience : [],
    education: Array.isArray(p.education) ? p.education : [],
    projects: Array.isArray(p.projects) ? p.projects : [],
    certifications: Array.isArray(p.certifications) ? p.certifications : [],
    // Extra contact fields — used by the rich rendered resume header,
    // not by the AI prompt itself.
    headline: p.headline || '',
    email: p.email || '',
    phone: p.phone || '',
    location: p.location || '',
    linkedinUrl: p.linkedinUrl || '',
    githubUrl: p.githubUrl || '',
    portfolioUrl: p.portfolioUrl || '',
  };
}

/**
 * The shared service expects a single JD string (50+ chars). We stitch
 * together whatever the Job / ExternalJob row has.
 */
function buildJobDescriptionForTailor(job) {
  if (!job) return '';
  const parts = [
    job.title ? `Job Title: ${job.title}` : '',
    (job.company || job.companyName) ? `Company: ${job.company || job.companyName}` : '',
    job.location ? `Location: ${job.location}` : '',
    job.description ? `\nDescription:\n${String(job.description).slice(0, 6000)}` : '',
    job.requirements ? `\nRequirements:\n${String(job.requirements).slice(0, 3000)}` : '',
  ].filter(Boolean);
  return parts.join('\n');
}

/**
 * Translate the rich `tailorProfileForJob` payload into the legacy diff
 * shape ReviewPage + resumePdf were designed against. When `rich` is
 * null (service failed), return an empty diff that still renders
 * harmlessly.
 */
function deriveDiffFromRich(profile, rich) {
  const origSummary = profile?.summary || '';
  if (!rich) {
    return {
      summaryOld: origSummary, summaryNew: '', experienceDiff: [],
      added: [], newSkills: [],
    };
  }
  const origSkills = new Set(flattenProfileSkills(profile?.skills).map((s) => String(s).toLowerCase()));
  const newSkills = (rich.skills || [])
    .filter((s) => !origSkills.has(String(s).toLowerCase()))
    .map((s) => `+ ${s}`);

  // Align tailored experience entries with original roles by
  // company+title. Anything that doesn't line up is "added".
  const origExp = profile?.experience || [];
  const tailoredExp = rich.experience || [];
  const origKey = (e) => `${(e.company || '').toLowerCase()}|${(e.title || e.position || '').toLowerCase()}`;
  const origMap = new Map(origExp.map((e) => [origKey(e), e]));

  const experienceDiff = [];
  const added = [];
  for (const t of tailoredExp) {
    const key = origKey(t);
    const match = origMap.get(key);
    const section = [t.company, t.title || t.position].filter(Boolean).join(' · ');
    if (match) {
      experienceDiff.push({
        section,
        old: stripTags(match.description || ''),
        new: t.description || '',
      });
    } else {
      // New entry the tailorer synthesised — we don't fabricate roles,
      // but some pipelines merge "Projects" into experience.
      const line = `${section}${t.description ? ` — ${String(t.description).slice(0, 140)}` : ''}`;
      added.push(`NEW · ${line}`);
    }
  }

  return {
    summaryOld: origSummary,
    summaryNew: rich.summary || '',
    experienceDiff,
    added,
    newSkills,
  };
}

/**
 * Short one-liner shown on the Review card next to the job. Uses the
 * match analysis if available, otherwise asks Claude for a single
 * sentence. Kept separate from the main tailoring call so the heavy
 * department-aware prompt stays focused on the resume itself.
 */
async function buildWhyPicked({ profile, job, memory, rich, diff }) {
  const strongMatches = rich?.matchAnalysis?.strongMatches || [];
  if (strongMatches.length >= 2) {
    return `Strong match on ${strongMatches.slice(0, 3).join(', ')}.`;
  }
  try {
    const prompt = `Given the candidate and job below, write ONE short sentence (max 20 words) explaining why this job was surfaced to them. No preamble.

CANDIDATE:
${summarizeProfileForPrompt(profile)}

JOB:
${summarizeJobForPrompt(job)}`;
    const res = await callAI({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 80,
      temperature: 0.3,
    });
    const raw = res?.choices?.[0]?.message?.content?.trim() || '';
    return raw.replace(/^["'\s]+|["'\s]+$/g, '') || 'Picked for your profile fit.';
  } catch (_err) {
    return 'Picked for your profile fit.';
  }
}

/**
 * draftCoverAndAnswers — thin adapter around the shared coverLetterService.
 * Kept as a named export so existing callers (prepareApplication, worker,
 * tests) continue to work.
 */
async function draftCoverAndAnswers({ profile, job, memory, formFields = [], tone, lines }) {
  return generateCoverLetterAndAnswers({ profile, job, memory, formFields, tone, lines });
}

/**
 * interviewUser — used by the Training page. Given the chat so far,
 * the training memory, and which topic to advance, returns the next
 * coach message + any memory updates to persist.
 */
// Fixed training question bank. Answering these IS the training — each
// row maps to something a job application would literally ask, so when
// the cover-letter agent has to fill that field later, it pulls the
// candidate's verbatim answer.  We walk this list in order, one question
// per turn, and stop when every row has a memory entry.
const TRAINING_QUESTIONS = [
  { id: 'motive_why',     topic: 'motive',  memoryKey: 'Why looking',              text: "First one — why are you looking for a new role right now?",                                            rephrase: "What's making you start the job search? Anything specific?" },
  { id: 'motive_ideal',   topic: 'motive',  memoryKey: 'Ideal next role',          text: "What's the role title or scope you'd actually want next?",                                              rephrase: "If you got to pick — what would the next job look like? Title, level, team size." },
  { id: 'motive_excite',  topic: 'motive',  memoryKey: 'What excites you',         text: "What kind of work actually gets you fired up day-to-day?",                                              rephrase: "Like — what type of project would you be excited to wake up to?" },
  { id: 'stories_proud',  topic: 'stories', memoryKey: 'Recent proud build',       text: "Tell me about something you built or shipped recently that you're proud of.",                          rephrase: "Just one project from the last year or so that actually went well — what was it?" },
  { id: 'stories_impact', topic: 'stories', memoryKey: 'Measurable impact',        text: "What's a number or result from your work you'd put on a resume — a lift, a savings, anything measurable?", rephrase: "Anything you moved that has a number on it? Revenue, latency, conversion — any metric." },
  { id: 'stories_hard',   topic: 'stories', memoryKey: 'Hard problem solved',      text: "What's a hard problem you solved? Just briefly — what it was and what you did.",                       rephrase: "A tough technical or team problem you cracked — give me the short version." },
  { id: 'values_style',   topic: 'values',  memoryKey: 'Working style',            text: "How do you actually like to work? Solo, pairing, async, lots of meetings — what's your mode?",         rephrase: "What's your natural working style? Like, day-to-day?" },
  { id: 'values_team',    topic: 'values',  memoryKey: 'Best team context',        text: "What kind of team do you do your best work in?",                                                       rephrase: "Describe a team you'd love to be on — size, vibe, whatever stands out." },
  { id: 'limits_no',      topic: 'limits',  memoryKey: 'Dealbreakers',             text: "What's something in a role you'd say no to, no matter the comp?",                                       rephrase: "Anything that would make you turn down an offer — even a great one?" },
  { id: 'limits_past',    topic: 'limits',  memoryKey: 'Past environment to avoid', text: "Is there a kind of environment or project you'd never want to go back to?",                            rephrase: "Past work setup that you'd avoid in the next job?" },
  { id: 'voice_describe', topic: 'voice',   memoryKey: 'How they describe role',   text: "When you describe what you do to a friend who isn't in tech — how do you say it?",                     rephrase: "Plain-English version of your job — how would you tell your mom what you do?" },
  { id: 'voice_phrase',   topic: 'voice',   memoryKey: 'Signature phrase',         text: "Got a phrase or word you actually use at work a lot — something that's recognizably you?",             rephrase: "Any catchphrase or word people associate with you at work?" },
];

const ACKS = ['Got it.', 'Cool.', 'Nice.', 'Okay.', 'Sweet.', 'Makes sense.', 'Solid.'];
const SKIP_RE = /^(skip|next|pass|move on|next question|let'?s move|move forward|next one|next step|i don'?t want|rather not|don'?t want to)/i;
const CONFUSE_RE = /\b(what|sorry|pardon|repeat|huh|come again|don'?t understand|didn'?t catch|i don'?t get|say (it )?again)\b/i;

async function interviewUser({ history, memory, currentTopic }) {
  const last = history.filter(h => h.role === 'me').slice(-1)[0];
  const lastText = last ? stripTags(last.content).trim() : '';

  const answeredKeys = new Set(memory.map(m => m.key));
  const remaining = TRAINING_QUESTIONS.filter(q => !answeredKeys.has(q.memoryKey));
  const TOPIC_ORDER = ['motive', 'stories', 'values', 'limits', 'voice'];

  // Done — no more questions. Short-circuit, no AI call.
  if (remaining.length === 0) {
    return {
      message: { role: 'ai', content: "That's everything I needed. Your agent's ready — start the pilot whenever you want." },
      memoryUpdates: [],
      topicComplete: true,
      allComplete: true,
      nextTopic: null,
    };
  }

  // Pick the next unanswered question. Prefer the saved currentTopic.
  const pickNext = (excludeKey = null) => {
    const startIdx = Math.max(0, TOPIC_ORDER.indexOf(currentTopic));
    for (let i = startIdx; i < TOPIC_ORDER.length; i += 1) {
      const q = remaining.find(r => r.topic === TOPIC_ORDER[i] && r.memoryKey !== excludeKey);
      if (q) return q;
    }
    return remaining.find(r => r.memoryKey !== excludeKey) || remaining[0];
  };

  // First turn — warm welcome + plan + purpose. NO question yet, so the
  // user gets oriented before being asked anything.
  if (history.length === 0) {
    const greeting = "Hey, welcome! I'm going to be your agent's voice coach for a few minutes. "
      + "Here's the plan — I'll ask you about a dozen quick questions about how you work, what you're looking for, and how you actually talk. "
      + "It usually takes 5–10 minutes, and you can skip anything you don't feel like answering. "
      + "Why this matters: once I know your real voice, your agent can write applications that sound like you — not like a generic template. "
      + "Whenever you're ready, just say so and we'll start.";
    return {
      message: { role: 'ai', content: greeting },
      memoryUpdates: [],
      topicComplete: false,
      nextTopic: pickNext().topic,
    };
  }

  // Figure out which question we just asked (match the previous AI msg
  // text to the question bank).
  const lastAi = [...history].reverse().find(h => h.role === 'ai');
  const lastAiText = lastAi ? stripTags(lastAi.content).toLowerCase() : '';
  const lastQuestion = TRAINING_QUESTIONS.find(q =>
    lastAiText.includes(q.text.toLowerCase().slice(0, 25))
    || lastAiText.includes((q.rephrase || '').toLowerCase().slice(0, 25))
  ) || null;

  // Second turn — the user just responded to the welcome (no question
  // asked yet). Don't capture their "ready"/"yes" as an answer; just
  // launch into the first question.
  if (!lastQuestion) {
    const first = pickNext();
    return {
      message: { role: 'ai', content: `Awesome — let's go. ${first.text}` },
      memoryUpdates: [],
      topicComplete: false,
      nextTopic: first.topic,
    };
  }

  // Count how many times we've asked this exact question (original or
  // rephrased). Past 1, we force-advance to avoid loops.
  const asksOfThis = history.filter(h =>
    h.role === 'ai'
    && (stripTags(h.content).toLowerCase().includes(lastQuestion.text.toLowerCase().slice(0, 25))
        || stripTags(h.content).toLowerCase().includes((lastQuestion.rephrase || '').toLowerCase().slice(0, 25)))
  ).length;

  const lower = lastText.toLowerCase();
  const wordCount = lastText.split(/\s+/).filter(Boolean).length;
  const wantsSkip = SKIP_RE.test(lower);
  const isConfused = wordCount < 6 && CONFUSE_RE.test(lower);
  const ack = ACKS[Math.floor(Math.random() * ACKS.length)];

  // Confused + we haven't already rephrased → rephrase once, no advance.
  if (isConfused && asksOfThis < 2) {
    return {
      message: { role: 'ai', content: lastQuestion.rephrase || lastQuestion.text },
      memoryUpdates: [],
      topicComplete: false,
      nextTopic: lastQuestion.topic,
    };
  }

  // Decide: capture as answer or skip with no memory.
  let memoryUpdates = [];
  let prefix = ack;
  if (wantsSkip) {
    prefix = "No worries.";
  } else if (wordCount >= 2) {
    // Anything with substance becomes the answer. Trim runaway length.
    memoryUpdates = [{
      topic: lastQuestion.topic,
      key: lastQuestion.memoryKey,
      value: lastText.length > 600 ? `${lastText.slice(0, 600).trim()}…` : lastText,
    }];
  } else {
    // 0–1 words and not a clear skip — we've already rephrased once,
    // so move on rather than loop.
    prefix = "Let's keep going.";
  }

  const next = pickNext(lastQuestion.memoryKey);
  if (!next || (remaining.length === 1 && remaining[0].memoryKey === lastQuestion.memoryKey)) {
    return {
      message: { role: 'ai', content: `${prefix} That's everything — your agent's good to go.` },
      memoryUpdates,
      topicComplete: true,
      allComplete: true,
      nextTopic: null,
    };
  }

  return {
    message: { role: 'ai', content: `${prefix} ${next.text}` },
    memoryUpdates,
    topicComplete: lastQuestion.topic !== next.topic,
    nextTopic: next.topic,
  };
}

/* ================================================================
   Training coverage
   ================================================================ */

/**
 * The 5 progressive interview topics. Order matters — the UI uses
 * indices for the breadcrumb. `factsForFull` is how many distilled
 * memory rows we consider "complete" for that topic.
 */
const TRAINING_TOPICS = [
  { key: 'motive',  label: 'What drives you',        icon: '✦', sub: 'The real reason you do this',    factsForFull: 2 },
  { key: 'stories', label: "Moments you're proud of", icon: '★', sub: 'Wins you\'d bring up over coffee', factsForFull: 3 },
  { key: 'values',  label: 'How you work',            icon: '❖', sub: 'Your natural working style',       factsForFull: 2 },
  { key: 'limits',  label: "What you won't do",       icon: '⌦', sub: 'Dealbreakers, in your words',       factsForFull: 2 },
  { key: 'voice',   label: 'How you sound',           icon: '♫', sub: 'Phrases and tone we\'ll quote',    factsForFull: 2 },
];

/**
 * Compute live training coverage from the memory table + the config's
 * `currentTopic` pointer. Returns the exact shape the Training page
 * needs to render the ring, breadcrumb and %.
 */
async function computeTrainingCoverage(userId) {
  const rows = await ApplyPilotTrainingMemory.findAll({
    where: { userId },
    attributes: ['topic'],
  });
  const counts = rows.reduce((acc, r) => {
    if (!r.topic) return acc;
    acc[r.topic] = (acc[r.topic] || 0) + 1;
    return acc;
  }, {});

  const cfg = await getOrCreateConfig(userId);
  const savedCurrent = cfg.trainingCoverage?.currentTopic;

  // Compute per-topic completion %.
  const topics = TRAINING_TOPICS.map(t => {
    const n = counts[t.key] || 0;
    const pct = Math.min(100, Math.round((n / t.factsForFull) * 100));
    return { ...t, n, pct };
  });

  // Current topic: the saved one if valid, else first incomplete, else last.
  const firstIncomplete = topics.find(t => t.pct < 100);
  const currentTopic =
    (savedCurrent && topics.some(t => t.key === savedCurrent) ? savedCurrent : null) ||
    firstIncomplete?.key ||
    topics[topics.length - 1].key;

  const overallPct = Math.round(
    topics.reduce((a, t) => a + t.pct, 0) / topics.length
  );

  const withState = topics.map((t, i) => ({
    ...t,
    n: String(i + 1),   // breadcrumb numeral
    state:
      t.pct >= 100
        ? 'done'
        : t.key === currentTopic
          ? 'on'
          : 'idle',
    variant:
      t.pct >= 100 ? 'good' : t.pct >= 50 ? 'warn' : 'idle',
  }));

  return { topics: withState, currentTopic, overallPct };
}

/** Advance to the next incomplete topic, or the explicit `to` if given. */
async function setCurrentTrainingTopic(userId, to) {
  const cfg = await getOrCreateConfig(userId);
  const existing = cfg.trainingCoverage || {};
  let next = to;
  if (!next) {
    // Find the next topic after the saved one.
    const idx = TRAINING_TOPICS.findIndex(t => t.key === existing.currentTopic);
    const start = idx >= 0 ? idx + 1 : 0;
    const picked = TRAINING_TOPICS.slice(start).concat(
      TRAINING_TOPICS.slice(0, start)
    )[0];
    next = picked?.key || 'motive';
  }
  cfg.trainingCoverage = { ...existing, currentTopic: next };
  await cfg.save();
  return next;
}

/* ================================================================
   DB helpers — the route handlers call these.
   ================================================================ */

/** Get-or-create a config row for the given user. */
async function getOrCreateConfig(userId) {
  let cfg = await ApplyPilotConfig.findOne({ where: { userId } });
  if (!cfg) {
    cfg = await ApplyPilotConfig.create({
      userId,
      state: 'idle',
      criteria: {
        salaryFloorK: 140,
        matchThreshold: 70,
        dailyLimit: 10,
        reapplyCooldownDays: 45,
        answerConfidence: 75,
      },
      approval: 'review',
      rails: { humanPacing: true, uniqueContent: true, blockedCompanies: [] },
      demographics: {
        workAuthorization: null,
        sponsorship: null,
        genderIdentity: null,
        transgender: null,
        sexualOrientation: null,
        disability: null,
        veteran: null,
        ethnicity: null,
      },
      profile: {
        fullName: null,
        email: null,
        phone: null,
        linkedinUrl: null,
        githubUrl: null,
        portfolioUrl: null,
        currentLocation: null,
        relocationWillingness: null,
        noticePeriod: null,
        salaryExpectation: null,
      },
      trainingCoverage: { overallPct: 0, topics: [] },
    });
  }
  return cfg;
}

/** Count applications grouped by status, for the dashboard stat cards. */
async function getStats(userId) {
  const { sequelize } = require('../models');
  const [rows] = await sequelize.query(
    `SELECT status, COUNT(*)::int AS n
       FROM "ApplyPilotApplications"
      WHERE "userId" = :userId
      GROUP BY status`,
    { replacements: { userId } }
  );
  const byStatus = Object.fromEntries(rows.map(r => [r.status, r.n]));
  const appliedThisWeek = await ApplyPilotApplication.count({
    where: {
      userId,
      status: 'submitted',
      submittedAt: { [require('sequelize').Op.gte]: sevenDaysAgo() },
    },
  });

  return [
    {
      key: 'queue', label: 'In queue',
      value: (byStatus.prepared || 0) + (byStatus.preparing || 0),
      change: byStatus.prepared
        ? `${byStatus.prepared} prepared · ready to review`
        : 'Waiting for matches',
      icon: '⏳',
    },
    {
      key: 'applied', label: 'Applied this week',
      value: appliedThisWeek,
      change: '',
      icon: '✓',
    },
    {
      key: 'replies', label: 'Replies',
      value: 0, // wire up when you add a Reply model
      change: '',
      icon: '✉',
    },
    {
      key: 'interviews', label: 'Interviews',
      value: 0, // wire up from Interview model later
      change: '',
      icon: '★',
    },
  ];
}

/** Recent events — last 10 status transitions for this user. */
async function getActivity(userId, limit = 10) {
  const rows = await ApplyPilotApplication.findAll({
    where: { userId },
    order: [['updatedAt', 'DESC']],
    limit,
  });
  return rows.map(row => activityFromApp(row));
}

function activityFromApp(app) {
  const base = { id: app.id, live: app.status === 'preparing' };
  switch (app.status) {
    case 'scouting': return { ...base, title: `Scouting ${app.company}`, sub: app.role, time: relTime(app.updatedAt) };
    case 'preparing': return { ...base, title: `Tailoring resume for ${app.company}`, sub: app.role, time: relTime(app.updatedAt) };
    case 'prepared': return { ...base, title: `Prepared ${app.company} application`, sub: `${app.role} · ready for review`, time: relTime(app.preparedAt) };
    case 'approved': return { ...base, title: `Approved ${app.company} application`, sub: `${app.role} · queued for submission`, time: relTime(app.approvedAt || app.updatedAt) };
    case 'submitting': return { ...base, title: `Submitting to ${app.company}`, sub: app.role, time: relTime(app.updatedAt), live: true };
    case 'submitted': return { ...base, title: `Sent application to ${app.company}`, sub: app.role, time: relTime(app.submittedAt) };
    case 'rejected': return { ...base, title: `Skipped ${app.company}`, sub: app.rejectionReason || 'You rejected', time: relTime(app.rejectedAt) };
    case 'needs_attention': return { ...base, title: `Needs attention: ${app.company}`, sub: app.submissionError || 'Manual input required', time: relTime(app.updatedAt) };
    case 'failed': return { ...base, title: `Failed to submit to ${app.company}`, sub: app.submissionError || 'Submission failed', time: relTime(app.updatedAt) };
    case 'error': return { ...base, title: `Could not submit to ${app.company}`, sub: app.errorMessage || 'ATS error', time: relTime(app.updatedAt) };
    default: return { ...base, title: `${app.status} · ${app.company}`, sub: app.role, time: relTime(app.updatedAt) };
  }
}

/* ================================================================
   Prep & submit (called by worker.js or fire-and-forget from the route)
   ================================================================ */

/**
 * Prepare a single application end-to-end. Safe to call repeatedly —
 * skips if already prepared.
 *
 * Throws on failure. The prep worker catches the error, decides whether
 * to retry (transient) or mark the row needs_attention (terminal /
 * exhausted retries). Direct callers (CLI, tests) can wrap in try/catch.
 */
async function prepareApplication(appId) {
  const app = await ApplyPilotApplication.findByPk(appId);
  if (!app) throw new Error(`Application ${appId} not found`);
  if (['prepared', 'submitting', 'submitted'].includes(app.status)) return app;

  app.status = 'preparing';
  await app.save();

  const profile = await Profile.findOne({ where: { userId: app.userId } });
  const user = await User.findByPk(app.userId, { attributes: ['firstName', 'lastName', 'email'] });
  const job = await loadJobForApp(app);
  const memory = await ApplyPilotTrainingMemory.findAll({ where: { userId: app.userId } });
  const config = await ApplyPilotConfig.findOne({ where: { userId: app.userId } });
  const tailorSettings = config?.profile?.tailorSettings || null;

  // Cover-letter generator reads firstName/lastName for the sign-off,
  // but those live on User, not Profile. Enrich a plain copy so the
  // letter doesn't end with "the candidate".
  const profileForLetter = {
    ...(profile?.toJSON ? profile.toJSON() : (profile || {})),
    firstName: user?.firstName || profile?.firstName || '',
    lastName: user?.lastName || profile?.lastName || '',
  };

  const [tailored, draft] = await Promise.all([
    tailorResume({ profile, job, memory, tailorSettings }),
    draftCoverAndAnswers({
      profile: profileForLetter,
      job,
      memory,
      formFields: (Array.isArray(job?.formFields) && job.formFields.length > 0)
        ? job.formFields
        : defaultFormFields(),
    }),
  ]);

  app.tailoredResume = tailored;
  app.coverLetter = draft.coverLetter;
  app.formAnswers = draft.answers;
  app.whyPicked = tailored.whyPicked;
  app.status = 'prepared';
  app.preparedAt = new Date();
  app.errorMessage = null;
  await app.save();

  // Also create a TailoredProfile so it shows on the Profile page.
  try {
    const tp = await syncTailoredProfileFromApplication({ app, profile, tailored, job });
    // Store the link for the "Open full resume" button.
    app.tailoredResume = { ...tailored, tailoredProfileId: tp.id };
    await app.save();
  } catch (err) {
    console.warn('[applyPilot] TailoredProfile creation failed (non-blocking):', err.message);
  }

  return app;
}

/**
 * Classify a prep error so the worker knows whether to retry. Anthropic
 * overload (529) and gateway 503s are transient; everything else is
 * terminal and should immediately surface to the user.
 */
function isTransientPrepError(err) {
  if (!err) return false;
  if (err.status === 529 || err.status === 503 || err.status === 502) return true;
  if (err.error?.type === 'overloaded_error') return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('overloaded')
    || msg.includes('temporarily unavailable')
    || msg.includes('rate limit')
    || msg.includes('econnreset')
    || msg.includes('etimedout')
  );
}

/**
 * Enqueue a prep job. Thin wrapper around the queue with a singleton
 * key so the same appId can't be double-enqueued while one is pending.
 *
 * @param {string} appId
 * @param {{ autoSubmitOnReady?: boolean }} [opts]
 *   autoSubmitOnReady=true makes the worker enqueue submit when prep
 *   finishes and the user's config is approval='auto'. Used by the
 *   scout. Edit/resolve flows pass false so the user can review.
 */
async function enqueuePrep(appId, opts = {}) {
  const { enqueue, QUEUES } = require('../lib/queue');
  return enqueue(
    QUEUES.PREP,
    { appId, autoSubmitOnReady: !!opts.autoSubmitOnReady },
    { singletonKey: `prep:${appId}` },
  );
}

/**
 * Sync (create/update) a TailoredProfile row from an ApplyPilot application.
 * Dedup key: userId + company + role, so re-applying updates provenance
 * instead of creating noisy duplicates on the Profile page.
 */
async function syncTailoredProfileFromApplication({ app, profile, tailored, job }) {
  const resolvedJob = job || await loadJobForApp(app);
  const p = profile ? (profile.toJSON ? profile.toJSON() : profile) : {};
  const companyName = app.company || resolvedJob?.company || resolvedJob?.companyName || null;
  const jobTitle = app.role || resolvedJob?.title || 'Unknown role';
  const tailoredData = buildTailoredData(p, tailored, resolvedJob);
  const now = new Date();
  const computedSkillGaps = (tailored?.newSkills || []).map((s) => ({
    skill: s.replace(/^\+\s*/, ''),
    category: 'general',
    severity: 'low',
    description: 'Added by ApplyPilot tailoring',
  }));
  const payload = {
    userId: app.userId,
    jobTitle,
    jobUrl: resolvedJob?.applyUrl || resolvedJob?.sourceUrl || null,
    companyName,
    source: 'applypilot',
    applyPilotApplicationId: app.id,
    applyPilotSyncedAt: now,
    sourceMeta: {
      origin: 'applypilot',
      company: companyName,
      role: jobTitle,
      status: app.status,
      submittedAt: app.submittedAt || null,
      reviewPath: `/agent-arena/review/${app.id}`,
    },
    tailoredData,
    originalProfileSnapshot: {
      headline: p.headline,
      summary: p.summary,
      skills: p.skills,
      experience: p.experience,
      education: p.education,
    },
    matchScore: app.match || tailoredData.matchScore || null,
    skillGaps: computedSkillGaps,
    isActive: true,
  };

  // Prefer direct link first (idempotent updates for the same application).
  let existing = await TailoredProfile.findOne({
    where: { userId: app.userId, applyPilotApplicationId: app.id },
  });

  // Fallback dedupe for repeated applications to same company+role.
  if (!existing) {
    const allForUser = await TailoredProfile.findAll({
      where: { userId: app.userId, isActive: true },
      order: [['updatedAt', 'DESC']],
    });
    const wantedCompany = normalizeForDedupe(companyName);
    const wantedRole = normalizeForDedupe(jobTitle);
    existing = allForUser.find((row) => (
      normalizeForDedupe(row.companyName) === wantedCompany
      && normalizeForDedupe(row.jobTitle) === wantedRole
    )) || null;
  }

  if (existing) {
    if (!payload.jobUrl) payload.jobUrl = existing.jobUrl;
    if (!payload.skillGaps?.length) payload.skillGaps = existing.skillGaps || [];
    await existing.update(payload);
    return existing;
  }
  return TailoredProfile.create(payload);
}

function normalizeForDedupe(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function getOutcomeFeedback(userId) {
  const rows = await ApplyPilotApplication.findAll({
    where: { userId },
    attributes: ['outcomeType', 'outcomeReasonCategory', 'outcomeReason', 'rejectionReason', 'location', 'salaryText'],
    order: [['updatedAt', 'DESC']],
    limit: 50,
  });

  const feedback = {
    categories: new Set(),
    rejectedLocations: new Set(),
  };

  for (const r of rows) {
    const type = String(r.outcomeType || '').toLowerCase();
    const category = String(r.outcomeReasonCategory || '').toLowerCase();
    const reason = String(r.outcomeReason || r.rejectionReason || '').toLowerCase();
    const isRejection = type === 'rejection' || category || reason;
    if (!isRejection) continue;

    if (category) feedback.categories.add(category);
    if (!category) {
      if (/location|relocat|remote|onsite|visa/.test(reason)) feedback.categories.add('location');
      if (/salary|compensation|pay|rate/.test(reason)) feedback.categories.add('salary');
      if (/experience|senior|years|skill gap|qualification/.test(reason)) {
        feedback.categories.add('experience_gap');
      }
    }
    if (r.location) feedback.rejectedLocations.add(String(r.location).toLowerCase());
  }

  return {
    categories: Array.from(feedback.categories),
    rejectedLocations: Array.from(feedback.rejectedLocations),
  };
}

function applyOutcomeFeedbackToScore(score, job, feedback) {
  const adjusted = { ...score };
  const reasons = [];
  let penalty = 0;

  const cats = new Set(feedback?.categories || []);

  if (cats.has('experience_gap')) {
    const missing = Array.isArray(score.missingSkills) ? score.missingSkills.length : 0;
    if (missing > 0) {
      const p = Math.min(12, missing * 2);
      penalty += p;
      reasons.push(`experience_gap:-${p}`);
    }
  }

  if (cats.has('location')) {
    const location = String(job?.location || '').toLowerCase();
    if (location) {
      const seenBad = (feedback?.rejectedLocations || []).some((loc) => location.includes(loc));
      if (seenBad) {
        penalty += 8;
        reasons.push('location_repeat:-8');
      }
    }
  }

  if (cats.has('salary')) {
    const salaryText = String(job?.salary || job?.salaryRange || '').trim();
    if (!salaryText) {
      penalty += 4;
      reasons.push('salary_unknown:-4');
    }
  }

  adjusted.match = Math.max(0, Math.min(100, (parseInt(score.match, 10) || 0) - penalty));
  adjusted.feedbackAdjustments = reasons;
  return adjusted;
}

async function seedInterviewPrepDraftFromApplication(appId, invite = {}) {
  const app = await ApplyPilotApplication.findByPk(appId);
  if (!app) throw new Error(`Application ${appId} not found`);

  const profile = await TailoredProfile.findOne({
    where: {
      userId: app.userId,
      applyPilotApplicationId: app.id,
      isActive: true,
    },
    order: [['updatedAt', 'DESC']],
  });
  if (!profile) return null;

  const tailoredData = profile.tailoredData || {};
  const draft = {
    source: 'applypilot_interview_invite',
    applyPilotApplicationId: app.id,
    company: app.company,
    role: app.role,
    jd: invite.jobDescription || null,
    tailoredProfileId: profile.id,
    tailoredResume: app.tailoredResume || null,
    matchScore: app.match || null,
    knownGaps: profile.skillGaps || [],
    inviteMeta: invite,
    round: invite.round || null,
    format: invite.format || null,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };

  await profile.update({
    tailoredData: {
      ...tailoredData,
      interviewPrepDraft: draft,
    },
    sourceMeta: {
      ...(profile.sourceMeta || {}),
      latestInterviewInviteAt: new Date().toISOString(),
    },
  });

  app.outcomeType = 'interview_invite';
  app.outcomeMeta = {
    ...(app.outcomeMeta || {}),
    interviewInvite: invite,
  };
  await app.save();

  return draft;
}

async function recordApplicationOutcome(appId, outcome = {}) {
  const app = await ApplyPilotApplication.findByPk(appId);
  if (!app) throw new Error(`Application ${appId} not found`);

  const type = String(outcome.type || '').toLowerCase();
  const reasonCategory = String(outcome.reasonCategory || '').toLowerCase() || null;
  const reason = (outcome.reason || '').trim() || null;

  app.outcomeType = type || app.outcomeType;
  app.outcomeReasonCategory = reasonCategory;
  app.outcomeReason = reason;
  app.outcomeMeta = {
    ...(app.outcomeMeta || {}),
    ...outcome,
    receivedAt: new Date().toISOString(),
  };

  if (type === 'rejection') {
    app.status = 'rejected';
    app.rejectedAt = app.rejectedAt || new Date();
    app.rejectionReason = reason || app.rejectionReason;
  }

  await app.save();
  return app;
}

/**
 * Build a TailoredProfile-compatible `tailoredData` object.
 *
 * When the shared tailor pipeline returned rich output (`tailored.rich`),
 * we pass it straight through — it already has summary/skills/experience/
 * projects/changelog/matchAnalysis in the exact shape TailoredProfile
 * expects. When `rich` is missing (fallback path), we synthesise a
 * minimal TailoredProfile from the legacy diff + original profile.
 */
function buildTailoredData(profile, tailored, job) {
  const rich = tailored?.rich;
  const profileSkills = flattenProfileSkills(profile.skills);
  if (rich) {
    return {
      jobTitle: rich.jobTitle || job?.title || '',
      company: rich.company || job?.company || job?.companyName || '',
      title: rich.title || profile.headline || '',
      summary: rich.summary || profile.summary || '',
      skills: rich.skills || profileSkills,
      skillsGrouped: rich.skillsGrouped || null,
      experience: rich.experience || profile.experience || [],
      education: rich.education || profile.education || [],
      projects: rich.projects || profile.projects || [],
      matchScore: rich.matchScore ?? null,
      matchAnalysis: rich.matchAnalysis || {
        overallScore: null,
        strongMatches: profileSkills.slice(0, 5),
        gaps: [],
      },
      changelog: Array.isArray(rich.changelog) ? rich.changelog : [],
    };
  }
  // Legacy fallback — rebuild TailoredProfile from the diff.
  return buildTailoredDataFromDiff(profile, tailored, job);
}

async function loadJobForApp(app) {
  if (app.externalJobId) return ExternalJob.findByPk(app.externalJobId);
  if (app.jobId) return Job.findByPk(app.jobId);
  return null;
}

/* ================================================================
   Prompt helpers
   ================================================================ */

function summarizeProfileForPrompt(profile) {
  if (!profile) return '(profile missing)';
  const p = profile.toJSON ? profile.toJSON() : profile;
  const skills = flattenProfileSkills(p.skills);
  return [
    p.name ? `Name: ${p.name}` : null,
    p.headline ? `Headline: ${p.headline}` : null,
    p.summary ? `Summary: ${p.summary}` : null,
    skills.length ? `Skills: ${skills.join(', ')}` : null,
    p.experience?.length ? `Experience: ${JSON.stringify(p.experience).slice(0, 2000)}` : null,
  ].filter(Boolean).join('\n');
}

function summarizeJobForPrompt(job) {
  if (!job) return '(job missing)';
  const j = job.toJSON ? job.toJSON() : job;
  return [
    j.title ? `Title: ${j.title}` : null,
    j.company || j.companyName ? `Company: ${j.company || j.companyName}` : null,
    j.location ? `Location: ${j.location}` : null,
    j.description ? `Description: ${String(j.description).slice(0, 4000)}` : null,
    j.requirements ? `Requirements: ${String(j.requirements).slice(0, 2000)}` : null,
  ].filter(Boolean).join('\n');
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, '').trim();
}

/**
 * Fallback: build a TailoredProfile-compatible `tailoredData` from the
 * original profile and the ApplyPilot diff-style tailored resume. Only
 * used when the shared pipeline failed to return rich data.
 */
function buildTailoredDataFromDiff(profile, tailored, job) {
  const summary = stripTags(tailored.summaryNew || profile.summary || '');
  const skills = [...flattenProfileSkills(profile.skills)];
  for (const s of tailored.newSkills || []) {
    const clean = s.replace(/^\+\s*/, '');
    if (!skills.includes(clean)) skills.push(clean);
  }
  // Merge experience diffs onto original experience
  const experience = (profile.experience || []).map(exp => {
    const diff = (tailored.experienceDiff || []).find(d =>
      d.section && (exp.company || exp.title || '').toLowerCase().includes(
        d.section.split('·')[0].trim().toLowerCase()
      )
    );
    if (diff) {
      return { ...exp, description: stripTags(diff.new) || exp.description };
    }
    return exp;
  });
  return {
    jobTitle: job?.title || '',
    company: job?.company || job?.companyName || '',
    title: profile.headline || '',
    summary,
    skills,
    experience,
    education: profile.education || [],
    projects: profile.projects || [],
    matchScore: null,
    matchAnalysis: {
      overallScore: null,
      strongMatches: skills.slice(0, 5),
      gaps: (tailored.newSkills || []).map(s => s.replace(/^\+\s*/, '')),
    },
    changelog: [
      ...(tailored.summaryNew ? [{ section: 'summary', action: 'rewritten', detail: 'Tailored by ApplyPilot' }] : []),
      ...(tailored.experienceDiff || []).map(d => ({ section: d.section, action: 'rewritten', detail: 'Adjusted for JD' })),
      ...(tailored.added || []).map(a => ({ section: 'experience', action: 'added', detail: a })),
    ],
  };
}

function flattenProfileSkills(skills) {
  if (Array.isArray(skills)) return skills.filter(Boolean);
  if (!skills || typeof skills !== 'object') return [];

  const flattened = [];
  for (const value of Object.values(skills)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string' && entry.trim()) flattened.push(entry.trim());
      }
      continue;
    }
    if (typeof value === 'string' && value.trim()) flattened.push(value.trim());
  }

  return Array.from(new Set(flattened));
}

function relTime(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
function sevenDaysAgo() {
  const d = new Date(); d.setDate(d.getDate() - 7); return d;
}

module.exports = {
  // LLM boundary
  scoreJob,
  tailorResume,
  draftCoverAndAnswers,
  interviewUser,
  // DB helpers
  getOrCreateConfig,
  getStats,
  getActivity,
  prepareApplication,
  enqueuePrep,
  isTransientPrepError,
  syncTailoredProfileFromApplication,
  getOutcomeFeedback,
  applyOutcomeFeedbackToScore,
  seedInterviewPrepDraftFromApplication,
  recordApplicationOutcome,
  // Used by hybrid manual-submit routes to re-run prep pieces on demand.
  loadJobForApp,
  defaultFormFields,
  // Helpers exposed for the regenerate-resume gap-analysis pre-step,
  // so the route can build the same profileData/jobDescription strings
  // tailorResume() builds internally.
  buildProfileDataForTailor,
  buildJobDescriptionForTailor,
  // Training coverage
  computeTrainingCoverage,
  setCurrentTrainingTopic,
  TRAINING_TOPICS,
};
