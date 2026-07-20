const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const bookmarkletAuth = require('../middleware/bookmarkletAuth');
const { hashToken } = require('../middleware/bookmarkletAuth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');
const { BookmarkletToken, Profile } = require('../models');
const { generateAnswers, AnswerGenerationValidationError, AnswerGenerationParseError } = require('../services/answerGenerationService');

const MAX_ACTIVE_TOKENS_PER_USER = 10;

// @route   POST /api/bookmarklet/pair
// @desc    Mint a new long-lived bookmarklet token for the current user.
//          The raw token is returned exactly once — only its hash is stored.
// @access  Private (normal JWT)
router.post('/pair', authMiddleware, async (req, res) => {
  try {
    const activeCount = await BookmarkletToken.count({
      where: { userId: req.user.id, revokedAt: null },
    });
    if (activeCount >= MAX_ACTIVE_TOKENS_PER_USER) {
      return res.status(400).json({
        error: `You have ${activeCount} active bookmarklets already. Revoke one in Settings before adding another.`,
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const label = (req.body?.label || 'Mobile bookmarklet').toString().slice(0, 255);

    const record = await BookmarkletToken.create({
      userId: req.user.id,
      tokenHash: hashToken(rawToken),
      label,
    });

    res.json({
      success: true,
      token: rawToken,
      tokenId: record.id,
      label: record.label,
    });
  } catch (error) {
    console.error('[bookmarklet] Pair error:', error);
    res.status(500).json({ error: 'Failed to create bookmarklet token' });
  }
});

// @route   GET /api/bookmarklet/tokens
// @desc    List the current user's bookmarklet devices (never returns the raw token).
// @access  Private (normal JWT)
router.get('/tokens', authMiddleware, async (req, res) => {
  try {
    const tokens = await BookmarkletToken.findAll({
      where: { userId: req.user.id },
      attributes: ['id', 'label', 'createdAt', 'lastUsedAt', 'lastUsedOrigin', 'revokedAt'],
      order: [['createdAt', 'DESC']],
    });
    res.json({ tokens });
  } catch (error) {
    console.error('[bookmarklet] List tokens error:', error);
    res.status(500).json({ error: 'Failed to load bookmarklet devices' });
  }
});

// @route   DELETE /api/bookmarklet/tokens/:id
// @desc    Revoke a bookmarklet device.
// @access  Private (normal JWT)
router.delete('/tokens/:id', authMiddleware, async (req, res) => {
  try {
    const token = await BookmarkletToken.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!token) {
      return res.status(404).json({ error: 'Bookmarklet device not found' });
    }
    await token.update({ revokedAt: new Date() });
    res.json({ success: true });
  } catch (error) {
    console.error('[bookmarklet] Revoke token error:', error);
    res.status(500).json({ error: 'Failed to revoke bookmarklet device' });
  }
});

// @route   POST /api/bookmarklet/generate-answers
// @desc    Same AI answer generation as /api/profiles/generate-answers, but
//          authenticated via the bookmarklet token instead of a JWT, and CORS
//          is open on this path (see server.js) since the caller runs on an
//          arbitrary job-site origin. Fetches the profile server-side rather
//          than trusting the page to supply it.
// @access  Private (bookmarklet token)
router.post('/generate-answers', bookmarkletAuth, aiRateLimiter('tailor_profile'), async (req, res) => {
  try {
    const { questions, jobDescription, questionMeta } = req.body;

    const profile = await Profile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(400).json({
        error: 'Finish setting up your ProfileAI profile before using the bookmarklet.',
      });
    }

    const { answers } = await generateAnswers({
      userId: req.user.id,
      userFirstName: req.user.firstName,
      userLastName: req.user.lastName,
      questions,
      jobDescription,
      profile: profile.get({ plain: true }),
      questionMeta,
    });

    res.json({ success: true, answers });
  } catch (error) {
    if (error instanceof AnswerGenerationValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof AnswerGenerationParseError) {
      return res.status(500).json({ error: error.message });
    }
    console.error('[bookmarklet] Generate answers error:', error);
    res.status(500).json({ error: 'Error generating AI answers' });
  }
});

module.exports = router;
