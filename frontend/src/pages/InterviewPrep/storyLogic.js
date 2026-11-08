// Pure helpers for the "Your stories" section of Interview prep.

const str = (v) => (typeof v === 'string' ? v : '');

// Split spoken text into plain and [placeholder] segments.
export function splitSpoken(text) {
  const s = str(text);
  const out = [];
  const re = /\[([^\[\]]+)\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), placeholder: false });
    out.push({ text: m[0], placeholder: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), placeholder: false });
  return out;
}

// First sentence or line, trimmed to max characters.
export function firstLine(text, max = 110) {
  const s = str(text).replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const m = s.match(/^.+?[.!?](?=\s|$)/);
  const line = m ? m[0] : s;
  return line.length > max ? `${line.slice(0, max - 3).trimEnd()}...` : line;
}

// "From your work at X" line source, or empty string.
export function experienceLabel(ref) {
  const r = ref && typeof ref === 'object' ? ref : {};
  const where = str(r.company).trim() || str(r.project).trim();
  return where ? `From your work at ${where}` : '';
}

// A selection is { topicId, titleId }; it must point at a real title in the topics.
export function findSelection(topics, sel) {
  if (!sel || !Array.isArray(topics)) return null;
  const topic = topics.find((t) => t && t.id === sel.topicId);
  const title = topic && Array.isArray(topic.titles) ? topic.titles.find((t) => t && t.id === sel.titleId) : null;
  return topic && title ? { topic, title } : null;
}
export const canWrite = (topics, sel) => !!findSelection(topics, sel);

// Request body for writeStory from a valid selection.
export function writePayload(tailoredProfileId, topics, sel, extra = '') {
  const f = findSelection(topics, sel);
  if (!f) return null;
  const body = { tailoredProfileId, theme: str(f.topic.theme), title: str(f.title.title), experienceRef: f.title.experienceRef || {} };
  if (Array.isArray(extra)) {
    // Answers to the coach's questions: only the ones they wrote something for.
    const answers = answersFor(extra);
    if (answers.length) body.answers = answers;
  } else {
    const own = str(extra).replace(/\s+/g, ' ').trim().slice(0, 1200);
    if (own) body.details = own; // one free box, sent only when they gave one
  }
  return body;
}

// [{ question, answer }] from the questions and the typed answers (a map of question id to text).
export function answersFor(questions, answers = {}) {
  return (Array.isArray(questions) ? questions : [])
    .map((q) => ({ question: str(q && q.question), answer: str(q && q.answer !== undefined ? q.answer : answers[q && q.id]).replace(/\s+/g, ' ').trim().slice(0, 600) }))
    .filter((a) => a.question && a.answer)
    .slice(0, 4);
}

// Keyboard navigation for a radiogroup. Returns the next index or null.
export function nextRadioIndex(key, index, count) {
  if (!count) return null;
  if (key === 'ArrowDown' || key === 'ArrowRight') return (index + 1) % count;
  if (key === 'ArrowUp' || key === 'ArrowLeft') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

// Map an axios error to a UI state: { kind: 'upgrade' | 'limit' | 'message' | 'retry', message }.
export function storyError(e) {
  const status = e?.response?.status;
  const d = e?.response?.data || {};
  if (status === 403 && (d.upgradeRequired || d.code === 'upgrade_required')) return { kind: 'upgrade', message: '' };
  if (status === 429) return { kind: 'limit', message: '' };
  if (status === 409 && d.code === 'not_ready' && str(d.message)) return { kind: 'message', message: d.message };
  if (status === 422 && d.code === 'profile_empty' && str(d.message)) return { kind: 'message', message: d.message };
  if ((status === 409 || status === 422) && str(d.message)) return { kind: 'message', message: d.message };
  return { kind: 'retry', message: '' };
}

// Keep only well-formed stories, newest first.
export function cleanStories(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => s && typeof s === 'object' && s.id && str(s.spoken))
    .slice()
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

// Coerce a possibly messy story into render-safe strings.
export function safeList(v) {
  return (Array.isArray(v) ? v : []).map((x) => (typeof x === 'string' ? x : str(x?.text))).filter(Boolean);
}
// The coach's questions from the API: [{ id, question, hint }]. Objects with a question are kept; nothing else.
export function cleanQuestions(v) {
  return (Array.isArray(v) ? v : [])
    .map((q, i) => ({ id: str(q?.id) || `q${i + 1}`, question: str(q?.question), hint: str(q?.hint) }))
    .filter((q) => q.question)
    .slice(0, 4);
}
export function safeBeats(v) {
  return (Array.isArray(v) ? v : [])
    .map((b) => ({ label: str(b?.label), text: str(b?.text) }))
    .filter((b) => b.text);
}

// Which of the three steps is current (0 based): pick a story, make it yours, your story.
// The flow phases win; with no flow running, an open saved story is step three.
export function storyStep(phase, hasOpenStory) {
  if (phase === 'details' || phase === 'writing') return 1;
  if (phase === 'topics' || phase === 'findingTopics') return 0;
  return hasOpenStory ? 2 : 0;
}
// 'done' | 'current' | 'todo' for each of the three steps.
export function stepStates(current) {
  return [0, 1, 2].map((i) => (i < current ? 'done' : i === current ? 'current' : 'todo'));
}
