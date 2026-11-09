const express = require('express');
const { personalizeProbes, makeInterviewPrepService } = require('../services/interviewPrepService');
const { parseJob } = require('../services/interviewJobParseService');
const { suggestTopics, writeStory, cleanRef, cleanSpoken, storyQuestions } = require('../services/interviewStoriesService');

const { profileSnapshot } = require('../services/interviewPrepService');
const { cleanFocus } = require('../services/interviewFocus');
const { prepareQuestion } = require('../services/interviewQuestionPrepService');
const { reviewCode } = require('../services/interviewCodeService');
const { pickQuestions, practiceInstructions, cleanNotes, cleanSummary, PRACTICE_TOOLS } = require('../services/interviewPracticeService');

const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
const STORY_FEATURE = 'career_suggestions'; // stories share the existing allowance, never a second bucket
const PAID_TIERS = new Set(['pro', 'pro_plus']);
const SOURCES = ['tailored', 'link', 'text', 'role'];
const FEATURE = 'interview_prep'; // paid allowance (Pro and above); cache hits and shared research cost nothing

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500 && status !== 503) console.error('[interviewPrep]', err.message);
  return res.status(status).json({
    success: false,
    code: err.code || 'error',
    message: status >= 500 && status !== 503 ? 'Something went wrong. Try again.' : err.message,
  });
}

/** Run an express middleware as a promise: true if it called next, false if it answered itself. */
function runMiddleware(mw, req, res) {
  return new Promise((resolve, reject) => {
    let done = false;
    res.once('finish', () => { if (!done) { done = true; resolve(false); } });
    Promise.resolve(mw(req, res, (err) => { if (done) return; done = true; if (err) reject(err); else resolve(true); })).catch(reject);
  });
}

/** Standalone-only endpoints answer like a missing page for anyone without access. */
const standaloneOnly = (can) => (req, res, next) => (can(req.user) ? next() : res.status(404).json({ success: false, code: 'not_available', message: 'Not found' }));

const notFound = (res) => res.status(404).json({ success: false, code: 'not_found', message: 'Not found' });

function requirePaidPlan(req, res, next) {
  const u = req.user || {};
  if (u.role === 'admin' || PAID_TIERS.has(u.subscriptionTier)) return next();
  return res.status(403).json({ success: false, code: 'upgrade_required', upgradeRequired: true, message: 'Interview stories are part of Pro.' });
}

const storyView = (r) => ({
  id: r.id, theme: r.theme, title: r.title, spoken: r.spoken,
  beats: r.beats || [], tips: r.tips || [], needsYou: r.needsYou || [],
  experienceRef: { company: '', role: '', period: '', project: '', ...(r.experienceRef || {}) },
  createdAt: r.createdAt,
});

const labelOf = ({ company, jobTitle, level }) => {
  const role = String(jobTitle || '').replace(/\s+/g, ' ').trim();
  const c = String(company || '').replace(/\s+/g, ' ').trim();
  if (c) return `${role} at ${c}`.slice(0, 255);
  return `${String(level || '').trim()} ${role}`.trim().slice(0, 255);
};

function buildRouter({ service, authMiddleware, limiter, recordUsage, runModel, models, storyLimiter, storyModel, resolveJob, realtime, voiceLimiter, recordVoice, settleVoice, canUseStandalone = () => true }) {
  const router = express.Router();

  /** Best effort: remember that this user opened this prep. Never throws. */
  async function recordHistory(userId, prepId, { body, label }) {
    try {
      if (!models.UserInterviewPrep || !prepId) return;
      let tailoredProfileId = isUuid(body.tailoredProfileId) ? body.tailoredProfileId : null;
      if (tailoredProfileId) {
        const tp = await models.TailoredProfile.findOne({ where: { id: tailoredProfileId, userId } });
        if (!tp) tailoredProfileId = null;
      }
      const source = SOURCES.includes(body.source) ? body.source : (tailoredProfileId ? 'tailored' : 'link');
      const now = new Date();
      const existing = await models.UserInterviewPrep.findOne({ where: { userId, prepId } });
      if (existing) {
        const explicit = SOURCES.includes(body.source) || tailoredProfileId;
        await existing.update({ lastOpenedAt: now, label, ...(explicit ? { source } : {}), ...(tailoredProfileId ? { tailoredProfileId } : {}) });
      } else {
        await models.UserInterviewPrep.create({ userId, prepId, tailoredProfileId, source, label, lastOpenedAt: now });
      }
    } catch (e) {
      console.warn('[interviewPrep] history not recorded:', e && e.message);
    }
  }

  // Read a job link or pasted posting into company, title and level. A small read: no allowance used.
  router.post('/parse-job', authMiddleware, standaloneOnly(canUseStandalone), requirePaidPlan, async (req, res) => {
    try {
      const { url, text } = req.body || {};
      const job = await parseJob({ url, text }, { resolveJob, runModel });
      return res.json({ success: true, job });
    } catch (err) { return sendError(res, err); }
  });

  router.get('/mine', authMiddleware, standaloneOnly(canUseStandalone), async (req, res) => {
    try {
      const userId = req.user.id;
      const history = await models.UserInterviewPrep.findAll({ where: { userId }, order: [['lastOpenedAt', 'DESC']], limit: 30 });
      const ids = history.map((h) => h.prepId);
      if (!ids.length) return res.json({ success: true, preps: [] });
      const [rows, stories, practices] = await Promise.all([
        models.InterviewPrep.findAll({ where: { id: ids } }),
        models.InterviewStory.findAll({ where: { userId, prepId: ids }, attributes: ['prepId'] }),
        models.InterviewPracticeSession
          ? models.InterviewPracticeSession.findAll({ where: { userId, prepId: ids }, attributes: ['prepId'] })
          : Promise.resolve([]),
      ]);
      const practiceCounts = new Map();
      for (const ps of practices) practiceCounts.set(ps.prepId, (practiceCounts.get(ps.prepId) || 0) + 1);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const counts = new Map();
      for (const st of stories) counts.set(st.prepId, (counts.get(st.prepId) || 0) + 1);
      const preps = history.filter((h) => byId.has(h.prepId)).map((h) => {
        const row = byId.get(h.prepId);
        const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
        const scope = row.companyKey === 'general' ? 'role' : 'company';
        return {
          id: h.prepId,
          company: scope === 'role' ? '' : (payload.company || ''),
          role: payload.role || h.label || '',
          scope,
          level: scope === 'role' ? (payload.level || '') : '',
          status: row.status,
          generatedAt: row.generatedAt || null,
          lastOpenedAt: h.lastOpenedAt || null,
          storyCount: counts.get(h.prepId) || 0,
          practiceCount: practiceCounts.get(h.prepId) || 0,
          tailoredProfileId: h.tailoredProfileId || null,
        };
      });
      return res.json({ success: true, preps });
    } catch (err) { return sendError(res, err); }
  });

  router.post('/', authMiddleware, async (req, res) => {
    try {
      const { company, jobTitle, level, refresh } = req.body || {};
      // Role-and-level prep (no company) belongs to the standalone section.
      if (!String(company || '').trim() && !canUseStandalone(req.user)) return res.status(404).json({ success: false, code: 'not_available', message: 'Not found' });
      const out = await service.start({
        company, jobTitle, level, refresh: refresh === true,
        gate: () => runMiddleware(limiter, req, res),
      });
      if (out.blocked) return undefined; // the rate limiter already answered
      if (out.started) await recordUsage(req.user.id, FEATURE).catch(() => {});
      await recordHistory(req.user.id, out.id, { body: req.body || {}, label: labelOf({ company, jobTitle, level }) });
      return res.json({ success: true, id: out.id, status: out.status, ...(out.prep ? { prep: out.prep } : {}) });
    } catch (err) { return sendError(res, err); }
  });

  router.get('/:id', authMiddleware, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, code: 'not_found', message: 'Not found' });
      const out = await service.get(req.params.id);
      if (!out) return res.status(404).json({ success: false, code: 'not_found', message: 'Not found' });
      if (models.UserInterviewPrep) {
        Promise.resolve(models.UserInterviewPrep.update({ lastOpenedAt: new Date() }, { where: { userId: req.user.id, prepId: req.params.id } })).catch(() => {});
      }
      return res.json({ success: true, status: out.status, prep: out.prep, error: out.error });
    } catch (err) { return sendError(res, err); }
  });

  router.post('/:id/personalize', authMiddleware, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, code: 'not_found', message: 'Not found' });
      const { tailoredProfileId, profile } = req.body || {};
      const prepRow = await service.get(req.params.id);
      if (!prepRow) return res.status(404).json({ success: false, code: 'not_found', message: 'Not found' });
      if (prepRow.status !== 'ready' || !prepRow.prep) {
        return res.status(409).json({ success: false, code: 'not_ready', message: 'The research is not ready yet.' });
      }

      let source = null;
      if (tailoredProfileId) {
        if (!isUuid(tailoredProfileId)) return res.status(400).json({ success: false, code: 'invalid_request', message: 'Invalid tailoredProfileId' });
        const tp = await models.TailoredProfile.findOne({ where: { id: tailoredProfileId, userId: req.user.id } });
        if (!tp) return res.status(404).json({ success: false, code: 'not_found', message: 'Tailored profile not found' });
        const data = tp.tailoredData && typeof tp.tailoredData === 'object' ? tp.tailoredData : {};
        source = { title: tp.jobTitle, ...data };
      } else if (profile && typeof profile === 'object' && !Array.isArray(profile)) {
        if (JSON.stringify(profile).length > 60000) return res.status(413).json({ success: false, code: 'too_large', message: 'Profile is too large' });
        source = profile;
      } else {
        const row = await models.Profile.findOne({ where: { userId: req.user.id } });
        source = row ? row.toJSON() : null;
      }
      if (!source) return res.status(422).json({ success: false, code: 'profile_empty', message: 'Add some details to your profile first.' });

      // Per-user, small, not cached.
      const gateOk = await runMiddleware(limiter, req, res);
      if (!gateOk) return undefined;
      const probes = await personalizeProbes({ prep: prepRow.prep, profile: source, runModel });
      await recordUsage(req.user.id, FEATURE).catch(() => {});
      return res.json({ success: true, probes });
    } catch (err) { return sendError(res, err); }
  });

  /** Ready research + the profile to write from (tailored profile owned by the user, else the user's Profile). Answers and returns null on failure. */
  async function loadStoryContext(req, res) {
    if (!isUuid(req.params.id)) { notFound(res); return null; }
    const prepRow = await service.get(req.params.id);
    if (!prepRow) { notFound(res); return null; }
    if (prepRow.status !== 'ready' || !prepRow.prep) {
      res.status(409).json({ success: false, code: 'not_ready', message: 'The research is not ready yet.' });
      return null;
    }
    const { tailoredProfileId } = req.body || {};
    let source = null;
    if (tailoredProfileId) {
      if (!isUuid(tailoredProfileId)) { res.status(400).json({ success: false, code: 'invalid_request', message: 'Invalid tailoredProfileId' }); return null; }
      const tp = await models.TailoredProfile.findOne({ where: { id: tailoredProfileId, userId: req.user.id } });
      if (!tp) { res.status(404).json({ success: false, code: 'not_found', message: 'Tailored profile not found' }); return null; }
      const data = tp.tailoredData && typeof tp.tailoredData === 'object' ? tp.tailoredData : {};
      source = { title: tp.jobTitle, ...data };
    } else {
      const row = await models.Profile.findOne({ where: { userId: req.user.id } });
      source = row ? row.toJSON() : null;
    }
    if (!source) { res.status(422).json({ success: false, code: 'profile_empty', message: 'Add some details to your profile first.' }); return null; }
    return { prepRow, source, tailoredProfileId: tailoredProfileId || null };
  }

  router.post('/:id/stories/topics', authMiddleware, requirePaidPlan, async (req, res) => {
    try {
      const ctx = await loadStoryContext(req, res);
      if (!ctx) return undefined;
      if (!(await runMiddleware(storyLimiter, req, res))) return undefined;
      const topics = await suggestTopics({ prep: ctx.prepRow.prep, profile: ctx.source, runModel: storyModel });
      await recordUsage(req.user.id, STORY_FEATURE).catch(() => {});
      return res.json({ success: true, topics });
    } catch (err) { return sendError(res, err); }
  });

  // Questions the coach asks about the chosen story before writing it. Part of the same story, so it
  // checks the allowance but does not use one up; the write call does.
  router.post('/:id/stories/questions', authMiddleware, requirePaidPlan, async (req, res) => {
    try {
      const { theme, title, experienceRef } = req.body || {};
      const ctx = await loadStoryContext(req, res);
      if (!ctx) return undefined;
      if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ success: false, code: 'invalid_request', message: 'A story title is required.' });
      if (!(await runMiddleware(storyLimiter, req, res))) return undefined;
      const questions = await storyQuestions({ prep: ctx.prepRow.prep, profile: ctx.source, theme, title, experienceRef: cleanRef(experienceRef), runModel: storyModel });
      return res.json({ success: true, questions });
    } catch (err) { return sendError(res, err); }
  });

  router.post('/:id/stories', authMiddleware, requirePaidPlan, async (req, res) => {
    try {
      const { theme, title, experienceRef, details, answers } = req.body || {};
      const ctx = await loadStoryContext(req, res);
      if (!ctx) return undefined;
      if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ success: false, code: 'invalid_request', message: 'A story title is required.' });
      if (!(await runMiddleware(storyLimiter, req, res))) return undefined;
      const prep = ctx.prepRow.prep;
      const ref = cleanRef(experienceRef);
      const written = await writeStory({ prep, profile: ctx.source, theme, title, experienceRef: ref, details: typeof details === 'string' ? details : '', answers: Array.isArray(answers) ? answers.slice(0, 4) : [], runModel: storyModel });
      const row = await models.InterviewStory.create({
        userId: req.user.id, prepId: req.params.id, tailoredProfileId: ctx.tailoredProfileId,
        company: String(prep.company || '').slice(0, 255), role: String(prep.role || '').slice(0, 255),
        theme: String(theme || '').replace(/\s+/g, ' ').trim().slice(0, 255), title: title.replace(/\s+/g, ' ').trim().slice(0, 255),
        spoken: written.spoken, beats: written.beats, tips: written.tips, needsYou: written.needsYou, experienceRef: ref,
      });
      await recordUsage(req.user.id, STORY_FEATURE).catch(() => {});
      return res.json({ success: true, story: storyView(row) });
    } catch (err) { return sendError(res, err); }
  });

  router.get('/:id/stories', authMiddleware, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return notFound(res);
      const rows = await models.InterviewStory.findAll({ where: { userId: req.user.id, prepId: req.params.id }, order: [['createdAt', 'DESC']] });
      return res.json({ success: true, stories: rows.map(storyView) });
    } catch (err) { return sendError(res, err); }
  });

  router.patch('/:id/stories/:storyId', authMiddleware, async (req, res) => {
    try {
      if (!isUuid(req.params.id) || !isUuid(req.params.storyId)) return notFound(res);
      const { spoken } = req.body || {};
      if (typeof spoken !== 'string' || !spoken.trim()) return res.status(400).json({ success: false, code: 'invalid_request', message: 'Story text is required.' });
      const row = await models.InterviewStory.findOne({ where: { id: req.params.storyId, userId: req.user.id, prepId: req.params.id } });
      if (!row) return notFound(res);
      await row.update({ spoken: cleanSpoken(spoken) });
      return res.json({ success: true, story: storyView(row) });
    } catch (err) { return sendError(res, err); }
  });

  router.delete('/:id/stories/:storyId', authMiddleware, async (req, res) => {
    try {
      if (!isUuid(req.params.id) || !isUuid(req.params.storyId)) return notFound(res);
      const row = await models.InterviewStory.findOne({ where: { id: req.params.storyId, userId: req.user.id, prepId: req.params.id } });
      if (!row) return notFound(res);
      await row.destroy();
      return res.json({ success: true });
    } catch (err) { return sendError(res, err); }
  });

  /* ---------- Practice out loud ---------- */

  const attemptView = (r) => ({ id: r.id, question: r.question, language: r.language, code: r.code, review: r.review || null, createdAt: r.createdAt });

  const practiceView = (r) => ({
    id: r.id, startedAt: r.startedAt || null, seconds: r.seconds == null ? 0 : r.seconds,
    summary: r.summary || '', topTip: r.topTip || '', notes: Array.isArray(r.notes) ? r.notes : [], createdAt: r.createdAt,
  });

  // Open a realtime voice session for the interview coach. Paid plan, then the voice minutes allowance.
  router.post('/:id/practice/session', authMiddleware, requirePaidPlan, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return notFound(res);
      const prepRow = await service.get(req.params.id);
      if (!prepRow) return notFound(res);
      if (prepRow.status !== 'ready' || !prepRow.prep) {
        return res.status(409).json({ success: false, code: 'not_ready', message: 'The research is not ready yet.' });
      }
      const { tailoredProfileId, questions: requested } = req.body || {};
      let source = null;
      if (tailoredProfileId) {
        if (!isUuid(tailoredProfileId)) return res.status(400).json({ success: false, code: 'invalid_request', message: 'Invalid tailoredProfileId' });
        const tp = await models.TailoredProfile.findOne({ where: { id: tailoredProfileId, userId: req.user.id } });
        if (!tp) return res.status(404).json({ success: false, code: 'not_found', message: 'Tailored profile not found' });
        const data = tp.tailoredData && typeof tp.tailoredData === 'object' ? tp.tailoredData : {};
        source = { title: tp.jobTitle, ...data };
      } else {
        const row = await models.Profile.findOne({ where: { userId: req.user.id } });
        source = row ? row.toJSON() : null;
      }

      // The allowance the existing coach voice session uses; it answers 429 itself.
      if (!(await runMiddleware(voiceLimiter, req, res))) return undefined;
      if (!realtime.isConfigured()) return res.status(503).json({ error: 'Voice is not configured on this server' });

      const prep = prepRow.prep;
      const stories = await models.InterviewStory.findAll({ where: { userId: req.user.id, prepId: req.params.id }, order: [['createdAt', 'DESC']] });
      // No model call here: the caller's own list (which may carry resume probes) or the reported questions.
      let focus = null;
      try {
        const mine = await models.UserInterviewPrep.findOne({ where: { userId: req.user.id, prepId: req.params.id } });
        focus = cleanFocus(mine && mine.focus);
      } catch { /* practice just is not steered */ }
      const questions = pickQuestions({ prep, requested, focus });
      let lastTime = null;
      try {
        const last = await models.InterviewPracticeSession.findOne({ where: { userId: req.user.id, prepId: req.params.id }, order: [['createdAt', 'DESC']] });
        if (last && (last.summary || last.topTip)) lastTime = { summary: last.summary, topTip: last.topTip };
      } catch { /* the greeting just will not mention it */ }
      if (!questions.length) return res.status(422).json({ success: false, code: 'no_questions', message: 'There are no questions to practice yet.' });

      const maxSessionMinutes = req.voiceAllowance?.maxSessionMinutes || null;
      const instructions = practiceInstructions({
        firstName: req.user.firstName, prep, questions, stories,
        profileSnapshot: profileSnapshot(source), maxMinutes: maxSessionMinutes, lastTime, focus,
      });
      const session = await realtime.createRealtimeSession({ instructions, tools: PRACTICE_TOOLS, maxMinutes: maxSessionMinutes });

      if (req.voiceAllowance) await recordVoice(req.user.id, maxSessionMinutes, { feature: 'interview_practice', prepId: req.params.id });
      return res.json({ success: true, ...session, maxSessionMinutes, questions });
    } catch (err) {
      console.error('[interviewPrep] practice session failed:', (err && (err.detail || err.message)) || err);
      return res.status(500).json({ success: false, code: 'error', message: 'Could not start the practice session.' });
    }
  });

  router.post('/:id/practice/sessions', authMiddleware, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return notFound(res);
      const prepRow = await service.get(req.params.id);
      if (!prepRow) return notFound(res);
      const body = req.body || {};
      const notes = cleanNotes(body.notes);
      const { summary, topTip } = cleanSummary({ summary: body.summary, topTip: body.topTip });
      if (!notes.length && !summary) return res.status(400).json({ success: false, code: 'invalid_request', message: 'Nothing to save.' });
      const started = new Date(body.startedAt);
      const secs = Math.round(Number(body.seconds));
      const row = await models.InterviewPracticeSession.create({
        userId: req.user.id, prepId: req.params.id,
        startedAt: Number.isNaN(started.getTime()) ? new Date() : started,
        seconds: Number.isFinite(secs) ? Math.min(3600, Math.max(0, secs)) : 0,
        notes, summary, topTip,
      });
      // The session reserved its full allowance when it started; now the real length is known.
      if (settleVoice && models.AIUsage && row.seconds > 0) {
        try {
          const recent = await models.AIUsage.findAll({ where: { userId: req.user.id, featureType: 'coach_voice_session' }, order: [['usedAt', 'DESC']], limit: 5 });
          const open = recent.find((u) => u.metadata && u.metadata.prepId === req.params.id && u.metadata.settled !== true);
          if (open) await settleVoice(open.id, req.user.id, Math.ceil(row.seconds / 60));
        } catch (e) { console.error('[interviewPrep] settle voice minutes failed:', e.message); }
      }
      return res.json({ success: true, id: row.id });
    } catch (err) { return sendError(res, err); }
  });

  // "How to prepare" for one reported question. Written once, kept on the shared prep, so it costs one small call per question.
  router.post('/:id/questions/:qid/prepare', authMiddleware, requirePaidPlan, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return notFound(res);
      const row = await models.InterviewPrep.findByPk(req.params.id);
      const payload = row && row.status === 'ready' && row.payload && typeof row.payload === 'object' ? row.payload : null;
      if (!payload) return notFound(res);
      const q = (Array.isArray(payload.questions) ? payload.questions : []).find((x) => x && x.id === req.params.qid);
      if (!q) return notFound(res);
      const cached = payload.preparation && Array.isArray(payload.preparation[q.id]) ? payload.preparation[q.id] : null;
      if (cached && cached.length) return res.json({ success: true, prepare: cached, cached: true });
      const prepare = await prepareQuestion({ prep: payload, question: q, runModel });
      if (!prepare.length) return res.status(422).json({ success: false, code: 'prepare_failed', message: 'We could not write that just now. Please try again.' });
      // Re-read so two people opening different questions at once do not overwrite each other.
      const fresh = (await models.InterviewPrep.findByPk(req.params.id)) || row;
      const base = fresh.payload && typeof fresh.payload === 'object' ? fresh.payload : payload;
      await fresh.update({ payload: { ...base, preparation: { ...(base.preparation || {}), [q.id]: prepare } } });
      return res.json({ success: true, prepare, cached: false });
    } catch (err) { return sendError(res, err); }
  });

  // What this user is aiming at on this prep. Private to them; the shared research is never changed.
  router.get('/:id/focus', authMiddleware, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return notFound(res);
      const row = await models.UserInterviewPrep.findOne({ where: { userId: req.user.id, prepId: req.params.id } });
      return res.json({ success: true, focus: cleanFocus(row && row.focus) });
    } catch (err) { return sendError(res, err); }
  });

  router.put('/:id/focus', authMiddleware, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return notFound(res);
      const prepRow = await service.get(req.params.id);
      if (!prepRow) return notFound(res);
      const focus = cleanFocus(req.body);
      const row = await models.UserInterviewPrep.findOne({ where: { userId: req.user.id, prepId: req.params.id } });
      if (row) await row.update({ focus });
      else await models.UserInterviewPrep.create({ userId: req.user.id, prepId: req.params.id, source: 'role', lastOpenedAt: new Date(), focus });
      return res.json({ success: true, focus });
    } catch (err) { return sendError(res, err); }
  });

  // Code practice: review one typed answer. Nothing is run. Uses the same allowance as the stories.
  router.post('/:id/code/review', authMiddleware, requirePaidPlan, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return notFound(res);
      const prepRow = await service.get(req.params.id);
      if (!prepRow || !prepRow.prep) return notFound(res);
      const { question, language, code } = req.body || {};
      if (!(await runMiddleware(storyLimiter, req, res))) return undefined;
      const out = await reviewCode({ prep: prepRow.prep, question, language, code, runModel: storyModel });
      const row = await models.InterviewCodeAttempt.create({
        userId: req.user.id, prepId: req.params.id, question: out.question, language: out.language, code: out.code, review: out.review,
      });
      await recordUsage(req.user.id, STORY_FEATURE).catch(() => {});
      return res.json({ success: true, attempt: attemptView(row) });
    } catch (err) { return sendError(res, err); }
  });

  router.get('/:id/code/attempts', authMiddleware, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return notFound(res);
      const rows = await models.InterviewCodeAttempt.findAll({ where: { userId: req.user.id, prepId: req.params.id }, order: [['createdAt', 'DESC']], limit: 30 });
      return res.json({ success: true, attempts: rows.map(attemptView) });
    } catch (err) { return sendError(res, err); }
  });

  router.get('/:id/practice/sessions', authMiddleware, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return notFound(res);
      if (!(await service.get(req.params.id))) return notFound(res);
      const rows = await models.InterviewPracticeSession.findAll({ where: { userId: req.user.id, prepId: req.params.id }, order: [['createdAt', 'DESC']], limit: 20 });
      return res.json({ success: true, sessions: rows.slice(0, 20).map(practiceView) });
    } catch (err) { return sendError(res, err); }
  });

  return router;
}

function defaultRouter() {
  const authMiddleware = require('../middleware/auth');
  const { aiRateLimiter, recordAIUsage, coachVoiceSessionLimiter, recordVoiceSession, settleVoiceSession } = require('../middleware/aiRateLimiter');
  const coachRealtimeService = require('../services/coachRealtimeService');
  const models = require('../models');
  const { runModel, runStoryModel, getSharedService } = require('../services/interviewPrepRuntime');
  const service = getSharedService();
  const { createCoachTailorService } = require('../services/coachTailorService');
  const { resolveJob } = createCoachTailorService();
  return buildRouter({ service, authMiddleware, limiter: aiRateLimiter(FEATURE), recordUsage: recordAIUsage, runModel, models, storyLimiter: aiRateLimiter(STORY_FEATURE), storyModel: runStoryModel, resolveJob, realtime: coachRealtimeService, voiceLimiter: coachVoiceSessionLimiter, recordVoice: recordVoiceSession, settleVoice: settleVoiceSession, canUseStandalone: require('../config/featureFlags').userCanAccessInterviewPrepStandalone });
}

const router = defaultRouter();
module.exports = router;
module.exports.buildRouter = buildRouter;
