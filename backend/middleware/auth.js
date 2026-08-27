const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * A rejected token and an unreachable database are different failures, and
 * conflating them is a user-visible bug.
 *
 * Both paths used to land in one `catch` that answered 401 "Token is not
 * valid" and logged nothing. So whenever the database struggled — a pool
 * timeout, a dropped connection, a statement timeout — every signed-in user
 * was told their session was invalid, and the frontend logged them out. The
 * silence made it invisible in the logs too.
 *
 * Load testing on 2026-08-27 reproduced this exactly: a lock-table exhaustion
 * in Postgres surfaced as 100% spurious 401s at a concurrency of 20, with
 * nothing at all in the application log to explain it.
 *
 * jsonwebtoken raises a small, known set of errors for a genuinely bad token.
 * Anything else is our problem, not the caller's, and deserves a 503 the
 * client can retry rather than a logout.
 */
const TOKEN_ERROR_NAMES = new Set([
  'JsonWebTokenError',   // malformed, bad signature, wrong audience
  'TokenExpiredError',   // exp in the past
  'NotBeforeError',      // nbf in the future
]);

const isTokenError = (err) => TOKEN_ERROR_NAMES.has(err?.name);

const AUTH_MIDDLEWARE_SAFE_USER_FIELDS = [
  'id',
  'email',
  'firstName',
  'lastName',
  'slug',
  'googleId',
  'githubId',
  'profilePictureUrl',
  'role',
  'subscriptionTier',
  'subscriptionStatus',
  'subscriptionExpiresAt',
  'isActive',
  'emailVerified',
  'emailVerifiedAt',
  'emailVerificationToken',
  'emailVerificationExpiresAt',
  'createdAt',
  'updatedAt'
];

const authMiddleware = async (req, res, next) => {
  try {
    // Idempotent: if a parent router already populated req.user, skip the
    // DB lookup. This lets us mount authMiddleware once at the app boundary
    // (e.g. alongside requireVerifiedEmail) without doubling the cost when
    // the inner router also declares authMiddleware per-handler.
    if (req.user && req.userId) {
      return next();
    }

    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findByPk(decoded.id, {
      attributes: AUTH_MIDDLEWARE_SAFE_USER_FIELDS
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Token is not valid' });
    }

    // Authed responses are user-specific. Prevent ANY shared/proxy/browser
    // caching so a different account on the same browser (or a stale 304
    // from disk cache) can never see another user's data. Without this we
    // observed prod sessions reading the previous user's /profiles/me body
    // from the HTTP cache after re-login.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    if (isTokenError(error)) {
      return res.status(401).json({ error: 'Token is not valid' });
    }
    // Infrastructure failure. Say so — a 503 keeps the session intact and
    // tells the client this is worth retrying.
    logger.error({ err: error, path: req.originalUrl }, '[auth] token verification failed for a non-token reason');
    res.status(503).json({ error: 'Service temporarily unavailable, please retry.' });
  }
};

// Optional auth - sets req.user if token is valid, but doesn't reject if no token
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: AUTH_MIDDLEWARE_SAFE_USER_FIELDS
    });

    if (user && user.isActive) {
      req.user = user;
      req.userId = user.id;
    }
    next();
  } catch (error) {
    // Auth is optional here, so continuing anonymously is the right call
    // either way — but a database failure still needs to be visible. Left
    // unlogged, a struggling database silently downgrades every signed-in
    // visitor to the anonymous experience with no trace of why.
    if (!isTokenError(error)) {
      logger.error({ err: error, path: req.originalUrl }, '[optionalAuth] falling back to anonymous after a non-token error');
    }
    next();
  }
};

module.exports = authMiddleware;
module.exports.optionalAuth = optionalAuth;
