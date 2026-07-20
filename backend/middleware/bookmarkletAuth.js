const crypto = require('crypto');
const { BookmarkletToken, User } = require('../models');
const { AUTH_MIDDLEWARE_SAFE_USER_FIELDS } = require('./auth');

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Authenticates requests from the mobile bookmarklet runtime, which runs on
 * arbitrary third-party job-site origins and therefore can't use the normal
 * JWT-in-localStorage flow. The bookmarklet carries a long-lived opaque
 * token (minted once via POST /api/bookmarklet/pair) instead.
 *
 * Populates req.user / req.userId in the same shape authMiddleware does, so
 * downstream middleware (aiRateLimiter, recordAIUsage) works unmodified.
 */
async function bookmarkletAuth(req, res, next) {
  try {
    const rawToken = req.header('Authorization')?.replace('Bearer ', '') || req.query.t;

    if (!rawToken) {
      return res.status(401).json({ error: 'Missing bookmarklet token' });
    }

    const tokenHash = hashToken(rawToken);
    const tokenRecord = await BookmarkletToken.findOne({ where: { tokenHash } });

    if (!tokenRecord || tokenRecord.revokedAt) {
      return res.status(401).json({ error: 'Invalid or revoked bookmarklet token' });
    }

    const user = await User.findByPk(tokenRecord.userId, {
      attributes: AUTH_MIDDLEWARE_SAFE_USER_FIELDS,
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid or revoked bookmarklet token' });
    }

    req.user = user;
    req.userId = user.id;
    req.bookmarkletToken = tokenRecord;

    // Best-effort usage tracking — never blocks the request.
    tokenRecord.update({
      lastUsedAt: new Date(),
      lastUsedOrigin: req.get('origin') || null,
    }).catch((err) => console.warn('[bookmarklet] Failed to update token usage:', err.message));

    next();
  } catch (error) {
    console.error('[bookmarklet] Auth error:', error);
    res.status(401).json({ error: 'Bookmarklet authentication failed' });
  }
}

module.exports = bookmarkletAuth;
module.exports.hashToken = hashToken;
