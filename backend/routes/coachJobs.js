/**
 * POST /api/profiles/coach/job-preview
 *
 * Three live openings for the profile the coach just built, shown on the
 * closing card before sign-up. See services/coachJobPreview.js. No model is
 * called, so guests are held by the per-IP strict limiter only.
 *
 * Mounted in server.js at /api/profiles/coach, ahead of the profiles router.
 */

const express = require('express');
const { strictLimiter } = require('../middleware/rateLimiters');
const { findPreviewJobs } = require('../services/coachJobPreview');

const router = express.Router();

// @route   POST /api/profiles/coach/job-preview
// @desc    A few live jobs for a coach draft, no scores
// @access  Public (rate limited by IP, nothing persisted)
router.post('/job-preview', strictLimiter, async (req, res) => {
  try {
    res.json(await findPreviewJobs(req.body || {}));
  } catch (error) {
    console.error('[CoachJobPreview] failed:', error.message);
    // The card simply does not show; nothing else depends on it.
    res.json({ jobs: [] });
  }
});

module.exports = router;
