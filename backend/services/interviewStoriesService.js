/**
 * Interview stories: the coach picks themes the interviewers care about,
 * suggests three grounded story titles per theme, then writes the chosen one
 * in a plain spoken voice. The model is injected (runModel) so tests never
 * touch the network.
 *
 * Fact rules are enforced in code as well as in the prompts: titles without a
 * usable experienceRef are dropped, topics need exactly three titles, and
 * every [placeholder] in the spoken text gets a needsYou entry.
 */
const { parseModelJson, profileSnapshot, clean } = require('./interviewPrepService');

/* ---------- text helpers ---------- */

/** No arrows, no em/en dashes in anything we emit. */
function plain(text) {
  return String(text ?? '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*(?:<?-{2,}>|[←-⇿⟵-⟿⬀-⯿]|=>|->|<-)\s*/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
const oneLine = (v, max) => clean(plain(v), max);
const strOrEmpty = (v) => (typeof v === 'string' ? v : '');

function cleanRef(ref) {
  const r = ref && typeof ref === 'object' && !Array.isArray(ref) ? ref : {};
  return {
    company: oneLine(strOrEmpty(r.company), 120),
    role: oneLine(strOrEmpty(r.role), 120),
    period: oneLine(strOrEmpty(r.period), 60),
    project: oneLine(strOrEmpty(r.project), 160),
  };
}
const refUsable = (r) => !!(r.company || r.project);

/* ---------- suggest topics ---------- */

const TOPICS_SYSTEM = `You are an interview coach. You get public research on what candidates reported being asked for a role at a company, plus the candidate's real profile. Pick ONE or TWO themes the interviewers clearly care about (for example "Leading through ambiguity", "Scaling a system"), preferably ones the profile can back up with a real story.
For each theme suggest EXACTLY THREE story titles. Each title must be grounded in something actually written in the profile: a job, a project, or a skill with evidence. Titles are short, human and specific, like "The week I rebuilt our billing queue at Equinix". Never generic ("A time I led a team").
Facts: use only what is in the profile. Never invent employers, projects, tools or outcomes. experienceRef must name the real company and/or project from the profile.
Style: no arrow characters, no em dashes.
Return ONLY JSON: {"topics":[{"theme":"","why":"one sentence tied to the research","questions":["up to 3 researched question texts this prepares for"],"titles":[{"title":"","angle":"one sentence on what the story would show","experienceRef":{"company":"","role":"","period":"","project":""}}]}]}`;

function cleanTopics(parsed) {
  const list = parsed && Array.isArray(parsed.topics) ? parsed.topics : [];
  const out = [];
  for (const t of list) {
    if (!t || typeof t !== 'object') continue;
    const theme = oneLine(t.theme, 80);
    if (!theme) continue;
    const seen = new Set();
    const titles = [];
    for (const c of Array.isArray(t.titles) ? t.titles : []) {
      if (!c || typeof c !== 'object') continue;
      const title = oneLine(c.title, 120);
      const experienceRef = cleanRef(c.experienceRef);
      if (!title || !refUsable(experienceRef) || seen.has(title.toLowerCase())) continue;
      seen.add(title.toLowerCase());
      titles.push({ title, angle: oneLine(c.angle, 240), experienceRef });
      if (titles.length === 3) break;
    }
    if (titles.length < 3) continue;
    const questions = (Array.isArray(t.questions) ? t.questions : [])
      .map((q) => oneLine(q, 300)).filter(Boolean)
      .slice(0, 3);
    out.push({ theme, why: oneLine(t.why, 300), questions, titles });
    if (out.length === 2) break;
  }
  return out.map((t, i) => ({
    id: `t${i + 1}`, theme: t.theme, why: t.why, questions: t.questions,
    titles: t.titles.map((c, j) => ({ id: `t${i + 1}${String.fromCharCode(97 + j)}`, ...c })),
  }));
}

function researchOf(prep) {
  return {
    role: prep.role, company: prep.company,
    topics: (prep.topics || []).slice(0, 8),
    questions: (prep.questions || []).slice(0, 15).map((q) => ({ text: q.text, category: q.category })),
  };
}

function requireSnapshot(profile) {
  const snapshot = profileSnapshot(profile);
  if (!snapshot) throw Object.assign(new Error('Add some details to your profile first.'), { status: 422, code: 'profile_empty' });
  return snapshot;
}

async function suggestTopics({ prep, profile, runModel }) {
  const snapshot = requireSnapshot(profile);
  const raw = await runModel({
    system: TOPICS_SYSTEM,
    prompt: `Research:\n${JSON.stringify(researchOf(prep))}\n\nCandidate profile:\n${snapshot}`,
    maxTokens: 2500, purpose: 'story_topics',
  });
  const topics = cleanTopics(parseModelJson(raw));
  if (!topics.length) throw Object.assign(new Error('Could not suggest stories from your profile. Try again.'), { status: 502, code: 'stories_failed' });
  return topics;
}

/* ---------- write story ---------- */

const STORY_SYSTEM = `You help a candidate prepare a story for a behavioral interview question. Write it so they can learn it and say it out loud.
Voice: first person, plain, conversational, short sentences, contractions are fine. No bullet points, no corporate jargon, no filler openers like "Certainly" or "Great question". It should take about a minute to say: 150 to 220 words.
FACT RULES: use only facts present in the candidate profile. Never invent employers, tools, team sizes, dates or outcomes. Where a number or an outcome is missing, write a bracketed placeholder such as [your number] or [what happened next] inside the spoken text, and add a short plain description of each placeholder to needsYou.
Style: no arrow characters, no em dashes.
Also give 3 to 4 beats (labels like "The situation", "What I did", "What changed", "What I learned", each with one or two plain sentences) and 2 to 3 short delivery tips.
Return ONLY JSON: {"spoken":"","beats":[{"label":"","text":""}],"tips":[""],"needsYou":[""]}`;

const PLACEHOLDER_RE = /\[([^\[\]]{1,80})\]/g;

function placeholdersOf(text) {
  const found = [];
  for (const m of String(text).matchAll(PLACEHOLDER_RE)) {
    const p = m[1].trim();
    if (p && !found.some((f) => f.toLowerCase() === p.toLowerCase())) found.push(p);
  }
  return found;
}

function cleanStory(parsed) {
  const p = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  const spoken = plain(strOrEmpty(p.spoken).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n')).slice(0, 2500);
  const words = spoken.split(/\s+/).filter(Boolean).length;
  if (words < 60) return null;
  const beats = (Array.isArray(p.beats) ? p.beats : [])
    .map((b) => ({ label: oneLine(b && b.label, 60), text: oneLine(b && b.text, 500) }))
    .filter((b) => b.label && b.text).slice(0, 4);
  const tips = (Array.isArray(p.tips) ? p.tips : []).map((t) => oneLine(t, 200)).filter(Boolean).slice(0, 3);
  const needsYou = (Array.isArray(p.needsYou) ? p.needsYou : []).map((n) => oneLine(n, 200)).filter(Boolean);
  // Every [placeholder] in the text must be explained.
  const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const lower = needsYou.map(norm);
  for (const ph of placeholdersOf(spoken)) {
    const key = norm(ph);
    if (!lower.some((n) => n.includes(key))) {
      needsYou.push(`Fill in [${ph}] with your real detail.`);
      lower.push(key);
    }
  }
  return { spoken, beats, tips, needsYou: needsYou.slice(0, 10) };
}

async function writeStory({ prep, profile, theme, title, experienceRef, runModel }) {
  const snapshot = requireSnapshot(profile);
  const t = oneLine(title, 120);
  if (!t) throw Object.assign(new Error('A story title is required.'), { status: 400, code: 'invalid_request' });
  const ref = cleanRef(experienceRef);
  const raw = await runModel({
    system: STORY_SYSTEM,
    prompt: `Interview: ${clean(prep.role, 120)} at ${clean(prep.company, 120)}\nTheme: ${oneLine(theme, 80)}\nStory title: ${t}\nGrounded in: ${JSON.stringify(ref)}\n\nResearch:\n${JSON.stringify(researchOf(prep))}\n\nCandidate profile:\n${snapshot}`,
    maxTokens: 1800, purpose: 'story_write',
  });
  const story = cleanStory(parseModelJson(raw));
  if (!story) throw Object.assign(new Error('Could not write that story. Try again.'), { status: 502, code: 'stories_failed' });
  return story;
}

/** Clean user-edited spoken text (same rules, no length floor). */
const cleanSpoken = (text) => plain(strOrEmpty(text).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n')).slice(0, 2500);

module.exports = { suggestTopics, writeStory, cleanTopics, cleanStory, cleanRef, cleanSpoken, plain, placeholdersOf, STORY_SYSTEM, TOPICS_SYSTEM };
