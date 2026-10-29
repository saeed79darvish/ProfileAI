/**
 * /api/career-context — what ProfilleAI knows about the signed-in candidate.
 *
 * GET     /             the record (empty fields when there is none yet)
 * PATCH   /             the person's own edit; replaces what it names
 * POST    /merge        the coach's write; fills gaps, or corrects with overwrite
 * POST    /summarize    a voice call's transcript in, a short summary saved
 * DELETE  /item         forget one field, the assessment, or one summary
 * DELETE  /             forget everything
 */

const express = require('express');
const authMiddleware = require('../middleware/auth');
const { aiRateLimiter, recordAIUsage } = require('../middleware/aiRateLimiter');
const { CareerContext } = require('../models');
const { makeCareerContextService } = require('../services/careerContextService');
const { callAI, HAIKU_MODEL } = require('../services/ai/core');
const { callSummaryPrompt } = require('../services/ai/prompts/careerContext');

const { invalidateJobsRankingForUser } = require('../services/jobEmbeddingService');

const router = express.Router();
const service = makeCareerContextService({ CareerContext });

/* The jobs feed ranks on this record (target role, stage, level, location),
   and caches what it read. A write here has to show on the next jobs load,
   not minutes later, or editing "About you" looks like it did nothing. */
const refreshJobs = (userId) => {
  try { invalidateJobsRankingForUser(userId); } catch { /* a stale cache is not worth a failed save */ }
};

router.use(authMiddleware);

const fail = (res, label, error) => {
  console.error(`[career-context] ${label}:`, error?.message);
  res.status(500).json({ error: 'Could not update what we know about you' });
};

router.get('/', async (req, res) => {
  try {
    res.json({ success: true, context: await service.get(req.user.id) });
  } catch (error) { fail(res, 'get', error); }
});

router.patch('/', async (req, res) => {
  try {
    const context = await service.edit(req.user.id, req.body || {});
    refreshJobs(req.user.id);
    res.json({ success: true, context });
  } catch (error) { fail(res, 'edit', error); }
});

router.post('/merge', async (req, res) => {
  try {
    const { overwrite, ...patch } = req.body || {};
    const context = await service.merge(req.user.id, patch, { overwrite: overwrite === true });
    refreshJobs(req.user.id);
    res.json({ success: true, context });
  } catch (error) { fail(res, 'merge', error); }
});

/* A call's transcript becomes a short written summary. The transcript itself
   is not stored anywhere: it arrives, is summarised, and is dropped. */
const MAX_LINES = 200;
router.post('/summarize', aiRateLimiter('profile_coach'), async (req, res) => {
  try {
    const lines = (Array.isArray(req.body?.transcript) ? req.body.transcript : [])
      .slice(-MAX_LINES)
      .map((l) => ({ role: l?.role === 'me' ? 'Them' : 'Coach', text: String(l?.text || '').slice(0, 1200) }))
      .filter((l) => l.text.trim());
    if (lines.length < 2) return res.status(400).json({ error: 'Nothing to summarise', code: 'too_short' });

    const response = await callAI({
      model: HAIKU_MODEL,
      max_tokens: 500,
      temperature: 0.3,
      messages: [{ role: 'user', content: callSummaryPrompt({ lines }) }],
    });
    const summary = String(response?.choices?.[0]?.message?.content || '').trim();
    if (!summary) return res.status(502).json({ error: 'Could not summarise that call' });

    await recordAIUsage(req.user.id, 'profile_coach');
    const context = await service.merge(req.user.id, { summary, summarySource: 'call' });
    res.json({ success: true, context });
  } catch (error) { fail(res, 'summarize', error); }
});

router.delete('/item', async (req, res) => {
  try {
    const { field, summaryIndex } = req.body || {};
    const context = await service.forget(req.user.id, {
      field: typeof field === 'string' ? field : undefined,
      summaryIndex: Number.isInteger(summaryIndex) ? summaryIndex : undefined,
    });
    refreshJobs(req.user.id);
    res.json({ success: true, context });
  } catch (error) { fail(res, 'forget', error); }
});

router.delete('/', async (req, res) => {
  try {
    const context = await service.clear(req.user.id);
    refreshJobs(req.user.id);
    res.json({ success: true, context });
  } catch (error) { fail(res, 'clear', error); }
});

module.exports = router;
