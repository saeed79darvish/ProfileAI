const express = require('express');
const { personalizeProbes, makeInterviewPrepService } = require('../services/interviewPrepService');
const { suggestTopics, writeStory, cleanRef, cleanSpoken, storyQuestions } = require('../services/interviewStoriesService');

const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
const STORY_FEATURE = 'career_suggestions'; // stories share the existing allowance, never a second bucket
const PAID_TIERS = new Set(['pro', 'pro_plus']);
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

function buildRouter({ service, authMiddleware, limiter, recordUsage, runModel, models, storyLimiter, storyModel }) {
  const router = express.Router();

  router.post('/', authMiddleware, async (req, res) => {
    try {
      const { company, jobTitle, level, refresh } = req.body || {};
      const out = await service.start({
        company, jobTitle, level, refresh: refresh === true,
        gate: () => runMiddleware(limiter, req, res),
      });
      if (out.blocked) return undefined; // the rate limiter already answered
      if (out.started) await recordUsage(req.user.id, FEATURE).catch(() => {});
      return res.json({ success: true, id: out.id, status: out.status, ...(out.prep ? { prep: out.prep } : {}) });
    } catch (err) { return sendError(res, err); }
  });

  router.get('/:id', authMiddleware, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, code: 'not_found', message: 'Not found' });
      const out = await service.get(req.params.id);
      if (!out) return res.status(404).json({ success: false, code: 'not_found', message: 'Not found' });
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

  return router;
}

function defaultRouter() {
  const authMiddleware = require('../middleware/auth');
  const { aiRateLimiter, recordAIUsage } = require('../middleware/aiRateLimiter');
  const models = require('../models');
  const { getResearch, runModel, runStoryModel } = require('../services/interviewPrepRuntime');
  const service = makeInterviewPrepService({ InterviewPrep: models.InterviewPrep, getResearch });
  return buildRouter({ service, authMiddleware, limiter: aiRateLimiter(FEATURE), recordUsage: recordAIUsage, runModel, models, storyLimiter: aiRateLimiter(STORY_FEATURE), storyModel: runStoryModel });
}

const router = defaultRouter();
module.exports = router;
module.exports.buildRouter = buildRouter;
