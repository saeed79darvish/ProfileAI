const jwt = require('jsonwebtoken');
const { User } = require('../models');

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

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token is not valid' });
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
    // Token invalid, but continue without user
    next();
  }
};

module.exports = authMiddleware;
module.exports.optionalAuth = optionalAuth;
