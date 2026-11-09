/**
 * interviewPracticeService, "Practice out loud" on a finished interview prep.
 *
 * Pure logic: choosing the questions, writing the realtime session's
 * instructions and tools, and cleaning the notes the browser sends back. The
 * OpenAI call itself lives in coachRealtimeService.createRealtimeSession.
 * Nothing here stores or sees audio; only short text notes are ever kept.
 */

const { profileSnapshot } = require('./interviewPrepService');
const { focusScore, focusSentence } = require('./interviewFocus');

const MAX_PICKED = 5;
const MAX_REQUESTED = 8;
const MAX_PROBES = 2;
const MAX_NOTES = 8;
const MAX_STORIES = 5;
const STORY_CHARS = 700;
const SNAPSHOT_CHARS = 3500;

const DASH_RE = /[—–]/g;
const ARROW_RE = /(?:-{2,}>|[=-]>|<[=-]|[←-⇿⟵-⟿⤀-⥿])/g;

/** One line of plain text: no em or en dashes, no arrows, collapsed whitespace, capped. */
function plain(value, max) {
  const text = String(value == null ? '' : value)
    .replace(DASH_RE, ',')
    .replace(ARROW_RE, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();
  return max ? text.slice(0, max).trim() : text;
}

const normKey = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function cleanRequested(requested) {
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(requested) ? requested : []) {
    if (!item || typeof item.text !== 'string') continue;
    const text = item.text.replace(/\s+/g, ' ').trim();
    if (text.length < 8 || text.length > 300) continue;
    const key = normKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ text, kind: item.kind === 'resume' ? 'resume' : 'reported' });
    if (out.length >= MAX_REQUESTED) break;
  }
  return out;
}

const ASKS = /^(what|why|how|when|where|which|who|whose|can|could|do|does|did|is|are|was|were|would|should|will|have|has|tell|describe|explain|walk|design|implement|write|build|create|given|define|compare|discuss|diagnose|debug|optimi[sz]e|architect|give|talk|show|solve|find|reverse|merge|sort|add|remove|convert|identify|list|name|detail|outline|suppose|imagine|you)\b/i;
const TOPIC_WORDS = /\b(questions?|topics?|concepts?|fundamentals|overview|interviews?|rounds?)\b/i;

/** Something a person could be asked. "System design questions for full stack roles" is a heading, not a question. */
function isRealQuestion(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length < 12) return false;
  if (/\?\s*$/.test(t) || ASKS.test(t)) return true;
  if (TOPIC_WORDS.test(t)) return false;
  return t.split(' ').length >= 6;
}

const CODE_VERBS = /^(write|implement|code|build|create|reverse|merge|sort|given|find|solve|convert|flatten|debounce|throttle|parse|validate|compute|count|remove|add|detect|check|return|fix|refactor|optimi[sz]e)\b/i;
const EXPLAIN = /^(what|why|how|when|where|which|who|can you explain|explain|describe|tell|walk|compare|difference|do you|have you|talk)\b/i;

/**
 * 'code' for a question that is answered by writing code, 'spoken' for everything you can
 * answer out loud: behavioral, design talk, and knowledge questions like "What is the virtual DOM?".
 * Code questions are practiced in the code editor, not on the voice call.
 */
function questionKind(q) {
  const text = String((q && q.text) || '').replace(/\s+/g, ' ').trim();
  const category = q && q.category;
  if (category === 'behavioral' || category === 'system_design') return 'spoken';
  if (CODE_VERBS.test(text)) return 'code';
  if (EXPLAIN.test(text)) return 'spoken';
  return category === 'coding' ? 'code' : 'spoken';
}

const SOFT_TOPIC = /\b(skills?|communication|collaboration|teamwork|leadership|mindset|soft)\b/i;

/** A knowledge question built from a review topic: "Explain React state management and hooks..." Never invented, always one of the research topics. */
function conceptQuestion(topic) {
  const name = plain(topic && topic.name, 80).replace(/[.?!]+$/, '');
  if (name.length < 4 || SOFT_TOPIC.test(name)) return null;
  return `Explain ${name} in your own words, and say when you have used it or would reach for it.`;
}

/** The research sometimes ends a question with where it was reported, "(reported for a technical phone screen)". Spoken aloud that reads oddly. */
const stripReported = (t) => String(t || '').replace(/\s*\((?:reported|asked|seen|mentioned)[^)]*\)\s*\.?\s*$/i, '').trim();

/** Most reported first, a mix of categories, a behavioral one if the research has any. */
function pickReported(questions, limit, focus = null) {
  const list = (Array.isArray(questions) ? questions : [])
    .filter((q) => q && typeof q.text === 'string' && isRealQuestion(q.text) && questionKind(q) === 'spoken')
    .map((q, i) => ({ q, i, freq: Number(q.frequency) || 0, hit: focusScore(q.text, focus) }))
    .sort((a, b) => b.hit - a.hit || b.freq - a.freq || a.i - b.i);
  if (!list.length || limit <= 0) return [];
  const chosen = [];
  const take = (entry) => { if (entry && !chosen.includes(entry)) chosen.push(entry); };
  take(list.find((e) => e.q.category === 'behavioral'));
  take(list.find((e) => e.hit > 0)); // what they said they are aiming at gets a place first
  const byCat = new Map();
  for (const e of list) {
    const c = e.q.category || 'other';
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c).push(e);
  }
  const queues = [...byCat.values()];
  while (chosen.length < Math.min(limit, list.length)) {
    let progressed = false;
    for (const queue of queues) {
      const next = queue.find((e) => !chosen.includes(e));
      if (next) { take(next); progressed = true; }
      if (chosen.length >= limit) break;
    }
    if (!progressed) break;
  }
  return chosen.slice(0, limit).sort((a, b) => b.freq - a.freq || a.i - b.i).map((e) => plain(stripReported(e.q.text), 300));
}

/**
 * Up to five questions to practice. Never invents one: each comes from the
 * research, a resume probe the caller supplied, or the caller's own list.
 */
function pickQuestions({ prep, resumeProbes, requested, focus = null } = {}) {
  const asked = cleanRequested(requested);
  const source = asked.length ? asked : (() => {
    const probes = [];
    const seen = new Set();
    for (const p of Array.isArray(resumeProbes) ? resumeProbes : []) {
      const text = plain(typeof p === 'string' ? p : (p && (p.question || p.text)), 300);
      if (text.length < 8 || seen.has(normKey(text))) continue;
      seen.add(normKey(text));
      probes.push({ text, kind: 'resume' });
      if (probes.length >= MAX_PROBES) break;
    }
    const reported = pickReported(prep && prep.questions, MAX_PICKED - probes.length, focus)
      .map((text) => ({ text, kind: 'reported' }));
    const picked = [...reported, ...probes];
    // Research can be thin for a role: fill with knowledge questions from the review topics.
    const have = new Set(picked.map((x) => normKey(x.text)));
    const topics = (Array.isArray(prep && prep.topics) ? prep.topics : []).map((t, i) => ({ t, i, hit: focusScore(t && t.name, focus) })).sort((a, b) => b.hit - a.hit || a.i - b.i).map((x) => x.t);
    for (const t of topics) {
      if (picked.length >= MAX_PICKED) break;
      const text = conceptQuestion(t);
      if (text && !have.has(normKey(text))) { have.add(normKey(text)); picked.push({ text, kind: 'reported' }); }
    }
    return picked;
  })();
  return source.slice(0, asked.length ? MAX_REQUESTED : MAX_PICKED).map((q, i) => ({ id: `p${i + 1}`, text: q.text, kind: q.kind }));
}

/* OpenAI Realtime function tools, same JSON shape as COACH_VOICE_TOOLS. */
const PRACTICE_TOOLS = [
  {
    type: 'function',
    name: 'record_feedback',
    description: 'Record your feedback on the answer you just heard. Call this once per question, right after you have spoken the feedback and before asking the next question.',
    parameters: {
      type: 'object',
      properties: {
        questionIndex: { type: 'integer', description: 'Which question this was, counting from 1' },
        question: { type: 'string', description: 'The question as you asked it' },
        worked: { type: 'string', description: 'The one specific thing that worked' },
        improve: { type: 'string', description: 'The one specific thing to improve' },
        usedStory: { type: 'boolean', description: 'True if they used one of their saved stories' },
        hadNumbers: { type: 'boolean', description: 'True if the answer included a concrete number or result' },
      },
      required: ['questionIndex', 'question', 'worked', 'improve', 'usedStory', 'hadNumbers'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'finish_session',
    description: 'End the practice. Call this once, after the last question or when time is nearly up, then say a short goodbye.',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Two sentences on how the practice went' },
        topTip: { type: 'string', description: 'The single most useful thing to work on next' },
      },
      required: ['summary', 'topTip'],
      additionalProperties: false,
    },
  },
];

function practiceInstructions({ firstName, prep = {}, questions = [], stories = [], profileSnapshot: snapshot = '', maxMinutes = null, lastTime = null, focus = null } = {}) {
  const role = plain(prep.role, 120) || 'this role';
  const company = plain(prep.company, 120);
  const target = company ? `${role} at ${company}` : role;
  const name = plain(firstName, 60);
  const minutes = Number(maxMinutes) > 0 ? Number(maxMinutes) : null;
  const qs = (Array.isArray(questions) ? questions : []).filter((q) => q && q.text);

  const numbered = qs.map((q, i) => `${i + 1}. ${plain(q.text, 300)}`).join('\n');
  const storyBlock = (Array.isArray(stories) ? stories : []).slice(0, MAX_STORIES).map((s) => {
    const title = plain(s && s.title, 120) || 'Untitled story';
    const theme = plain(s && s.theme, 120);
    return `- ${title}${theme ? ` (theme: ${theme})` : ''}: ${plain(s && s.spoken, STORY_CHARS)}`;
  }).join('\n');
  const last = lastTime && typeof lastTime === 'object' ? lastTime : null;
  const lastBlock = last && (last.summary || last.topTip)
    ? `${plain(last.summary, 400)}${last.topTip ? ` The tip they were given: ${plain(last.topTip, 300)}` : ''} Mention it once, in one short sentence in your greeting, then carry on. Never read it back in full.`
    : '';
  const aim = focusSentence(focus);
  const profile = String(snapshot || '').replace(DASH_RE, ',').replace(ARROW_RE, '').slice(0, SNAPSHOT_CHARS).trim();

  return [
    `You are a warm, direct interview coach running a spoken mock interview. You have no human name; if asked, you are an AI interview coach.${name ? ` The candidate's first name is ${plain(name)}.` : ''} They are preparing for a ${target} interview.`,
    '',
    'HOW THE SESSION RUNS',
    `- Open with one brief greeting that names the role${company ? ' and company' : ''}, say there are ${qs.length} question${qs.length === 1 ? '' : 's'}, then ask question 1.`,
    '- Ask ONE question at a time, in the order given. Never ask two at once and never skip ahead.',
    '- Keep every turn short and spoken. No lists, no markdown, no reading out symbols.',
    '- After each answer, give at most two sentences: one specific thing that worked and one specific thing to improve (structure, a missing number, length, or naming the decision they made). Speak the feedback first, then CALL the tool record_feedback with what you just said. Do not ask the next question in the same turn as the tool call; the next question comes in your next turn.',
    '- If they ask you to repeat a question or skip it, do it. A skipped question still gets a record_feedback call that says it was skipped.',
    '- Some questions test knowledge, like "Explain the virtual DOM". For those, say whether the answer was accurate, correct any mistake in one plain sentence, and name the one thing a stronger answer would add. Do not give a long lecture.',
    '- If the candidate has a saved story for the theme of a question, notice whether they used it and say so. Never read the story aloud and never put words in their mouth.',
    '- Never invent facts about the candidate. Use only the profile snapshot and saved stories below.',
    '- Stay on interview practice and politely decline anything else. Give no legal, HR or salary advice.',
    minutes
      ? `- Watch the clock. The session is capped at ${minutes} minute${minutes === 1 ? '' : 's'}. With about a minute left, stop asking new questions and wrap up.`
      : '- Watch the clock. If the session has gone long, or with about a minute left, wrap up.',
    '- To end: first SAY out loud a two sentence summary, the single most useful tip and a brief goodbye. Only then, as the very last thing in that same turn, CALL the tool finish_session with that summary and tip. Never speak after calling finish_session.',
    '',
    ...(lastBlock ? ['LAST TIME THEY PRACTICED THIS', lastBlock, ''] : []),
    ...(aim ? ['WHAT THEY ARE AIMING AT', `${aim} Let it shape which follow-up you lean on and how you word your feedback. Never ask a question that is not in the list below.`, ''] : []),
    'QUESTIONS, IN ORDER',
    numbered || '(none)',
    '',
    'SAVED STORIES (for your reference only)',
    storyBlock || '(none saved)',
    '',
    'PROFILE SNAPSHOT',
    profile || '(none)',
  ].join('\n');
}

const cleanBool = (v) => v === true || v === 'true';

function cleanNotes(notes) {
  const out = [];
  for (const n of Array.isArray(notes) ? notes : []) {
    if (!n || typeof n !== 'object') continue;
    const worked = plain(n.worked, 300);
    const improve = plain(n.improve, 300);
    const question = plain(n.question, 300);
    if (!worked && !improve && !question) continue;
    const idx = Math.round(Number(n.questionIndex));
    out.push({
      questionIndex: Number.isFinite(idx) && idx >= 1 ? Math.min(idx, 99) : out.length + 1,
      question, worked, improve,
      usedStory: cleanBool(n.usedStory),
      hadNumbers: cleanBool(n.hadNumbers),
    });
    if (out.length >= MAX_NOTES) break;
  }
  return out;
}

function cleanSummary({ summary, topTip } = {}) {
  return { summary: plain(summary, 500), topTip: plain(topTip, 300) };
}

module.exports = {
  isRealQuestion, questionKind, conceptQuestion, stripReported, pickQuestions, practiceInstructions, cleanNotes, cleanSummary, PRACTICE_TOOLS, plain, profileSnapshot,
};
