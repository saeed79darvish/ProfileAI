/**
 * POST /api/profiles/coach/tailor-preview
 *
 * The payoff moment right after the coach's profile preview: one job link (or
 * its text) in, a tailored resume and a match score out, before the visitor has
 * an account. See services/coachTailorService.js for how it reuses the
 * tailoring engine and the job-match scorer.
 *
 * Mounted in server.js at /api/profiles/coach, ahead of the profiles router.
 *
 * Metering:
 *   - Signed in: the same 'tailor_profile' allowance /tailor-for-job spends, so
 *     a preview counts as one of their tailorings.
 *   - Guest: the shared guestAnalysisLimiter as the IP backstop, plus a
 *     dedicated 3-per-IP-per-day counter for this endpoint. That counter is in
 *     memory on purpose: guests persist nothing, and GuestAIUsage rows are
 *     shared with the LinkedIn analyzer, so a DB-backed cap of 3 would also
 *     lock out anyone who had used the analyzer three times.
 */

const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { aiRateLimiter, recordAIUsage } = require('../middleware/aiRateLimiter');
const { guestAnalysisLimiter, hashIp, WINDOW_MS } = require('../middleware/guestRateLimiter');
const { clientIp } = require('../utils/clientIp');
const { createCoachTailorService, CoachTailorError, isOverloaded } = require('../services/coachTailorService');

const router = express.Router();
const service = createCoachTailorService();

const GUEST_PREVIEWS_PER_IP_PER_DAY = 3;

// Backstop shared with the other guest AI surfaces; the dedicated cap below is
// what actually holds this endpoint to three a day.
const guestBackstop = guestAnalysisLimiter({ perIpPerDay: 20, perUrlPerDay: 1000000 });

/** ipHash -> timestamps of previews that spent AI. Pruned on every touch. */
const guestPreviewLog = new Map();

function recentGuestPreviews(ipHash, now = Date.now()) {
  const kept = (guestPreviewLog.get(ipHash) || []).filter((t) => now - t < WINDOW_MS);
  if (kept.length) guestPreviewLog.set(ipHash, kept);
  else guestPreviewLog.delete(ipHash);
  return kept;
}

function guestDailyLimit(req, res, next) {
  if (process.env.GUEST_ANALYZER_DISABLE_LIMITS === 'true') return next();
  const ipHash = req.guestContext?.ipHash && req.guestContext.ipHash !== 'fail-open'
    ? req.guestContext.ipHash
    : hashIp(clientIp(req));
  req.coachTailorIpHash = ipHash;
  if (recentGuestPreviews(ipHash).length >= GUEST_PREVIEWS_PER_IP_PER_DAY) {
    return res.status(429).json({
      error: 'guest_daily_limit_ip',
      message: "You've used today's free tailored resumes. Create a free account to keep going.",
      upgradeSuggestion: 'sign_in',
      retryAfterSeconds: Math.round(WINDOW_MS / 1000),
    });
  }
  return next();
}

/** Signed in, spend their tailoring quota. Signed out, spend the IP's. */
function tailorPreviewGuard(req, res, next) {
  optionalAuth(req, res, () => {
    if (req.userId) return aiRateLimiter('tailor_profile')(req, res, next);
    return guestBackstop(req, res, () => guestDailyLimit(req, res, next));
  });
}

// @route   POST /api/profiles/coach/tailor-preview
// @desc    Tailored resume + match score for one job, from the coach draft
// @access  Public (guests metered by IP, nothing persisted)
router.post('/tailor-preview', tailorPreviewGuard, async (req, res) => {
  try {
    const { profile, jobUrl, jobDescription } = req.body || {};

    // Validation and the page fetch first: a bad link costs the guest nothing.
    const resolved = await service.resolveInput({ profile, jobUrl, jobDescription });

    if (!req.userId && req.coachTailorIpHash) {
      // Counted when AI is about to be spent, not when it succeeds, so a
      // script cannot loop on requests that fail after the model ran.
      const log = recentGuestPreviews(req.coachTailorIpHash);
      log.push(Date.now());
      guestPreviewLog.set(req.coachTailorIpHash, log);
    }

    const result = await service.runPreview(resolved);

    if (req.userId) {
      try {
        await recordAIUsage(req.userId, 'tailor_profile');
      } catch (err) {
        console.error('[coach-tailor] usage record failed:', err.message);
      }
    }

    return res.json(result);
  } catch (error) {
    if (error instanceof CoachTailorError) {
      return res.status(error.status).json({ code: error.code, error: error.message });
    }
    if (isOverloaded(error)) {
      return res.status(503).json({ error: 'AI service is temporarily overloaded. Please try again in a moment.' });
    }
    console.error('[coach-tailor] preview failed:', error);
    return res.status(500).json({ error: 'Error tailoring your resume for this job' });
  }
});

module.exports = router;
module.exports._guestPreviewLog = guestPreviewLog;
