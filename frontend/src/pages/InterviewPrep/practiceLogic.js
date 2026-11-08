// Pure helpers for "Practice out loud". The voice hook and the page keep their decisions here so they can be tested.

const str = (v) => (typeof v === 'string' ? v : '');

/** The question the coach is on after it recorded feedback for `questionIndex` (1-based). Never moves backwards. */
export function nextIndexAfterFeedback(current, questionIndex, total) {
  const cur = Number.isInteger(current) && current >= 1 ? current : 1;
  const n = Number(questionIndex);
  if (!Number.isInteger(n) || n < 1) return cur;
  const limit = Number.isInteger(total) && total >= 1 ? total + 1 : n + 1;
  return Math.min(limit, Math.max(cur, n + 1));
}

/** 48000 gives "0:48", 125000 gives "2:05". Bad input gives "0:00". */
export function formatElapsed(ms) {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** "3 minutes 5 seconds" style text for the summary screen. */
export function spokenDuration(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (!m) return `${r} ${r === 1 ? 'second' : 'seconds'}`;
  return `${m} ${m === 1 ? 'minute' : 'minutes'}${r ? ` ${r} ${r === 1 ? 'second' : 'seconds'}` : ''}`;
}

/** Map a failed session request to a state the page can show. */
export function sessionErrorState(e) {
  const status = e?.response?.status;
  const d = e?.response?.data || {};
  if (status === 403 && (d.code === 'upgrade_required' || d.upgradeRequired)) return { kind: 'upgrade', message: '' };
  if (status === 429 && d.reason === 'minutes_used') return { kind: 'limit', message: str(d.message) };
  if (status === 429 && (d.upgradeRequired || d.featureType)) return { kind: d.upgradeRequired ? 'upgrade' : 'limit', message: str(d.message) };
  if (status === 429) return { kind: 'limit', message: str(d.message) };
  if (status === 409 && d.code === 'not_ready') return { kind: 'not_ready', message: '' };
  if (status === 503) return { kind: 'unavailable', message: '' };
  return { kind: 'failed', message: str(d.message || d.error) };
}

/** Map a getUserMedia or handshake failure to 'mic-denied' or 'failed'. */
export function callErrorKind(err) {
  return /permission|denied|NotAllowed/i.test(String(err?.name || err?.message || err)) ? 'mic-denied' : 'failed';
}

/** Copy for each error kind on the ready screen. */
export function errorCopy(kind, message = '') {
  switch (kind) {
    case 'upgrade': return { title: 'Practice out loud is part of Pro', body: 'Pro and Pro Plus let you rehearse with a voice coach that listens and gives feedback after every answer.', plans: true };
    case 'limit': return { title: 'You have used this month’s practice time', body: message || 'Your allowance renews next month. Pro Plus includes more each month.', plans: true };
    case 'unavailable': return { title: 'Voice is not available right now', body: 'Please try again in a little while. Your prep is safe.', plans: false };
    case 'not_ready': return { title: 'Your prep is not ready yet', body: 'Come back in a moment, once the research has finished.', plans: false };
    case 'mic-denied': return { title: 'We could not use your microphone', body: 'Allow microphone access for this site in your browser, then try again.', plans: false };
    case 'dropped': return { title: 'The connection dropped', body: 'Your notes so far were kept. You can start again when you are ready.', plans: false };
    default: return { title: 'We could not start the session', body: message || 'Something went wrong on our side. Please try again.', plans: false };
  }
}

/** How many reported people or sources are behind a question. */
function reportedCount(q) {
  if (Number.isFinite(q?.count)) return q.count;
  if (Number.isFinite(q?.reportedCount)) return q.reportedCount;
  return Array.isArray(q?.sourceIds) ? q.sourceIds.length : 0;
}

/** The questions to practice: the most reported first (ties keep the prep's order), at most `n`, no repeats. */
export function pickTopQuestions(prep, n = 5) {
  const list = (Array.isArray(prep?.questions) ? prep.questions : []).filter((q) => q && str(q.text).trim());
  const seen = new Set();
  return list
    .map((q, i) => ({ q, i }))
    .sort((a, b) => (reportedCount(b.q) - reportedCount(a.q)) || (a.i - b.i))
    .map(({ q }) => ({ text: str(q.text).trim(), kind: 'reported' }))
    .filter((q) => { const k = q.text.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, n);
}

/** Request body for the session call. No questions means the server chooses. */
export function sessionBody(questions) {
  const list = (Array.isArray(questions) ? questions : []).filter((q) => q && str(q.text).trim());
  return list.length ? { questions: list.map((q) => ({ text: str(q.text).trim(), kind: q.kind === 'resume' ? 'resume' : 'reported' })) } : {};
}

/** Keep only well formed fields from a record_feedback call. Null when it has no usable question number. */
export function cleanNote(args) {
  const a = args && typeof args === 'object' ? args : {};
  const idx = Number(a.questionIndex);
  if (!Number.isInteger(idx) || idx < 1) return null;
  return {
    questionIndex: idx,
    question: str(a.question).trim(),
    worked: str(a.worked).trim(),
    improve: str(a.improve).trim(),
    usedStory: a.usedStory === true,
    hadNumbers: a.hadNumbers === true,
  };
}

/** Add a note, replacing any earlier note for the same question, in question order. */
export function upsertNote(notes, note) {
  if (!note) return Array.isArray(notes) ? notes : [];
  return [...(Array.isArray(notes) ? notes : []).filter((n) => n.questionIndex !== note.questionIndex), note]
    .sort((a, b) => a.questionIndex - b.questionIndex);
}

/** Keep only well formed fields from a finish_session call. */
export function cleanFinish(args) {
  const a = args && typeof args === 'object' ? args : {};
  return { summary: str(a.summary).trim(), topTip: str(a.topTip).trim() };
}

/** The chips under a note: a saved story was used, and numbers were missing. */
export function noteChips(note) {
  const out = [];
  if (note?.usedStory === true) out.push({ key: 'story', label: 'Used your story', tone: 'good' });
  if (note?.hadNumbers === false) out.push({ key: 'numbers', label: 'No numbers yet', tone: 'warn' });
  return out;
}

/** 'done' | 'current' | 'upcoming' for each question. */
export function questionStates(total, currentIndex) {
  const n = Number.isInteger(total) && total > 0 ? total : 0;
  return Array.from({ length: n }, (_, i) => (i + 1 < currentIndex ? 'done' : i + 1 === currentIndex ? 'current' : 'upcoming'));
}

/** Body for saving a finished session. */
export function buildSaveBody({ startedAt, seconds, notes, summary, topTip }) {
  const started = Number.isFinite(Date.parse(startedAt)) ? new Date(startedAt).toISOString() : new Date().toISOString();
  return {
    startedAt: started,
    seconds: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0,
    notes: (Array.isArray(notes) ? notes : []).map((n) => ({
      questionIndex: n.questionIndex, question: n.question, worked: n.worked, improve: n.improve, usedStory: n.usedStory === true, hadNumbers: n.hadNumbers === true,
    })),
    summary: str(summary),
    topTip: str(topTip),
  };
}

/** Whether a session is worth saving and showing: it has notes or a coach summary. */
export function hasSessionContent(notes, finished) {
  return (Array.isArray(notes) && notes.length > 0) || Boolean(finished && (finished.summary || finished.topTip));
}

const STOP = new Set(['about', 'tell', 'time', 'when', 'what', 'have', 'your', 'with', 'that', 'this', 'from', 'were', 'would', 'which', 'there', 'their', 'describe', 'walk', 'through', 'a time']);
const tokens = (s) => str(s).toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.slice(0, 5));

/** The saved story whose theme or title shares a word with the question, or null when we cannot tell. */
export function storyForQuestion(question, stories) {
  const q = new Set(tokens(question));
  if (!q.size) return null;
  for (const s of Array.isArray(stories) ? stories : []) {
    if (!s || typeof s !== 'object') continue;
    const theme = tokens(s.theme);
    if (theme.some((t) => q.has(t))) return s;
  }
  for (const s of Array.isArray(stories) ? stories : []) {
    if (!s || typeof s !== 'object') continue;
    if (tokens(s.title).filter((t) => q.has(t)).length >= 2) return s;
  }
  return null;
}

/** Count and latest summary line from the past sessions, for the plan on the prep page. */
export function practiceSummary(sessions) {
  const list = (Array.isArray(sessions) ? sessions : []).filter((s) => s && typeof s === 'object');
  if (!list.length) return { count: 0, line: '' };
  const time = (s) => Date.parse(s.startedAt || s.createdAt) || 0;
  const latest = list.slice().sort((a, b) => time(b) - time(a))[0];
  return { count: list.length, line: str(latest.summary).trim() };
}

/** "1 session" / "3 sessions". */
export function sessionsLabel(count) {
  return `${count} ${count === 1 ? 'session' : 'sessions'}`;
}
