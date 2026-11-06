const express = require('express');
const { personalizeProbes, makeInterviewPrepService } = require('../services/interviewPrepService');

const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
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

function buildRouter({ service, authMiddleware, limiter, recordUsage, runModel, models }) {
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

  return router;
}

function defaultRouter() {
  const authMiddleware = require('../middleware/auth');
  const { aiRateLimiter, recordAIUsage } = require('../middleware/aiRateLimiter');
  const models = require('../models');
  const { getResearch, runModel } = require('../services/interviewPrepRuntime');
  const service = makeInterviewPrepService({ InterviewPrep: models.InterviewPrep, getResearch });
  return buildRouter({ service, authMiddleware, limiter: aiRateLimiter(FEATURE), recordUsage: recordAIUsage, runModel, models });
}

const router = defaultRouter();
module.exports = router;
module.exports.buildRouter = buildRouter;
