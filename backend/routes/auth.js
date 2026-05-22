const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { User, Profile, RecruiterProfile, PasswordReset } = require('../models');
const auth = require('../middleware/auth');
const { sendPasswordResetEmail, sendEmailVerification } = require('../services/emailService');
const { buildUniqueUserSlug } = require('../utils/slug');
const rateLimit = require('express-rate-limit');
const featureFlags = require('../config/featureFlags');

// Constant pre-computed bcrypt hash used to keep login response time
// roughly constant when the supplied email doesn't exist. Without this,
// the "no such user" path returns in microseconds while the real path
// spends ~250ms in bcrypt.compare — a trivial user-enumeration oracle.
// Hash is for the literal string "invalid" at cost 12; value is fixed
// so we don't burn a hash on every cold boot.
const DUMMY_BCRYPT_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8.YkfQpODazjJ7P5G3jXk5q8wQ5h2K';

// Token lifetime — single source of truth. Falls back to 7d if env var unset.
const JWT_EXPIRES_IN = process.env.JWT_EXPIRE || '7d';

const AUTH_SAFE_USER_FIELDS = [
  'id',
  'email',
  'password',
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
  'emailVerificationExpiresAt'
];

const isSchemaDriftDbError = (error) => (
  error?.name === 'SequelizeDatabaseError' &&
  /column|relation|does not exist/i.test(String(error?.message || ''))
);

// Rate limiters for sensitive endpoints
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many registrations from this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Password complexity regex
// At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const passwordValidator = (value) => {
  if (!PASSWORD_REGEX.test(value)) {
    throw new Error('Password must be at least 8 characters and include uppercase, lowercase, number, and special character (@$!%*?&)');
  }
  return true;
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  registerLimiter,
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').custom(passwordValidator),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('role').optional().isIn(['candidate', 'recruiter']).withMessage('Invalid role')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName, role = 'candidate' } = req.body;

      // Candidate-only launch: reject recruiter signups until the
      // recruiter surface is enabled (see config/featureFlags.js).
      if (role === 'recruiter' && !featureFlags.recruiterSurface) {
        return res.status(403).json({ error: 'Recruiter signup is not available yet.' });
      }

      // Check if user exists. We respond with a generic error rather than
      // confirming/denying email registration to avoid user enumeration.
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'Unable to create account. Please try a different email or sign in.' });
      }

      // Generate a unique URL slug from the user's name (e.g. "saeed-darvish").
      // Used by the public profile route — see utils/slug.js.
      const slug = await buildUniqueUserSlug(User, firstName, lastName);

      // Create user
      const verificationTokenRaw = crypto.randomBytes(32).toString('hex');
      const verificationTokenHash = crypto.createHash('sha256').update(verificationTokenRaw).digest('hex');
      const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
      const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const user = await User.create({
        email,
        password,
        firstName,
        lastName,
        role,
        slug,
        emailVerified: false,
        emailVerificationToken: verificationTokenHash,
        emailVerificationCode: verificationCode,
        emailVerificationExpiresAt: verificationExpiresAt
      });

      // Send verification email (non-blocking if provider isn't configured)
      try {
        const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${verificationTokenRaw}`;
        await sendEmailVerification(user.email, user.firstName, verifyUrl, verificationCode);
      } catch (mailErr) {
        console.error('Error sending verification email during registration:', mailErr);
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          slug: user.slug,
          role: user.role,
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus,
          emailVerified: user.emailVerified
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Server error during registration' });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user. If no match we still run a bcrypt compare against a
      // dummy hash so the response time matches the "wrong password"
      // path — closing the user-enumeration timing side channel.
      const user = await User.findOne({
        where: { email },
        attributes: AUTH_SAFE_USER_FIELDS
      });
      if (!user) {
        await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if active
      if (!user.isActive) {
        return res.status(401).json({ error: 'Account is deactivated' });
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Fetch profile picture based on role
      let profilePicture = null;
      let hasRecruiterProfile = false;
      if (user.role === 'recruiter') {
        const recruiterProfile = await RecruiterProfile.findOne({ where: { userId: user.id } });
        profilePicture = recruiterProfile?.profilePicture || recruiterProfile?.companyLogo || null;
        hasRecruiterProfile = !!recruiterProfile;
      } else {
        const profile = await Profile.findOne({ where: { userId: user.id } });
        profilePicture = profile?.profilePicture || null;
      }

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          slug: user.slug,
          role: user.role,
          emailVerified: user.emailVerified,
          emailVerifiedAt: user.emailVerifiedAt,
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus,
          profilePicture,
          hasRecruiterProfile
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error during login' });
    }
  }
);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: [
        'id',
        'email',
        'firstName',
        'lastName',
        'slug',
        'role',
        'subscriptionTier',
        'subscriptionStatus',
        'subscriptionExpiresAt',
        'emailVerified',
        'emailVerifiedAt'
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch profile picture based on role - always get most recent profile
    let profilePicture = null;
    let hasRecruiterProfile = false;
    if (user.role === 'recruiter') {
      const recruiterProfile = await RecruiterProfile.findOne({ 
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
        attributes: ['profilePicture', 'companyLogo']
      });
      profilePicture = recruiterProfile?.profilePicture || recruiterProfile?.companyLogo || null;
      hasRecruiterProfile = !!recruiterProfile;
    } else {
      const profile = await Profile.findOne({ 
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
        attributes: ['profilePicture']
      });
      profilePicture = profile?.profilePicture || null;
    }

    // Disable caching for this endpoint
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      slug: user.slug,
      role: user.role,
      subscriptionTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      emailVerified: user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      profilePicture,
      hasRecruiterProfile
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/auth/impersonate/:userId
// @desc    Login as another user (recruiter/admin only)
// @access  Private (Recruiter/Admin)
router.post('/impersonate/:userId', auth, async (req, res) => {
  try {
    // Get the current user (recruiter)
    const recruiter = await User.findByPk(req.userId);
    
    if (!recruiter) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only recruiters and admins can impersonate
    if (recruiter.role !== 'recruiter' && recruiter.role !== 'admin') {
      return res.status(403).json({ error: 'Only recruiters and admins can use this feature' });
    }

    // Get the target user (candidate)
    const targetUser = await User.findByPk(req.params.userId);
    
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Only allow impersonating candidates (not other recruiters/admins)
    if (targetUser.role !== 'candidate') {
      return res.status(403).json({ error: 'Can only impersonate candidates' });
    }

    // Generate JWT for the target user with impersonation flag
    const token = jwt.sign(
      { 
        id: targetUser.id,
        impersonatedBy: recruiter.id,
        isImpersonation: true
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' } // Shorter expiry for impersonation
    );

    // Get profile picture
    const profile = await Profile.findOne({ where: { userId: targetUser.id } });
    const profilePicture = profile?.profilePicture || null;

    res.json({
      token,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        role: targetUser.role,
        subscriptionTier: targetUser.subscriptionTier,
        subscriptionStatus: targetUser.subscriptionStatus,
        profilePicture,
        isImpersonation: true,
        impersonatedBy: {
          id: recruiter.id,
          firstName: recruiter.firstName,
          lastName: recruiter.lastName
        }
      },
      // Return original token so recruiter can switch back
      originalToken: req.headers.authorization?.replace('Bearer ', '')
    });
  } catch (error) {
    console.error('Impersonation error:', error);
    res.status(500).json({ error: 'Server error during impersonation' });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  [body('email').isEmail().withMessage('Please provide a valid email')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;
      const user = await User.findOne({ where: { email } });

      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ 
          message: 'If an account with that email exists, a password reset link has been sent.' 
        });
      }

      // Invalidate any existing reset tokens for this user
      await PasswordReset.update(
        { usedAt: new Date() },
        { where: { userId: user.id, usedAt: null } }
      );

      // Generate token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Create reset record (expires in 1 hour)
      await PasswordReset.create({
        userId: user.id,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      });

      // Build reset URL
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

      // Send email
      try {
        await sendPasswordResetEmail(user.email, user.firstName, resetUrl);
      } catch (emailError) {
        console.error('Error sending password reset email:', emailError);
        // Don't fail the request if email fails - user can request again
      }

      res.json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password').custom(passwordValidator)
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, password } = req.body;

      // Hash the token to compare with stored hash
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Find valid reset token
      const resetRecord = await PasswordReset.findOne({
        where: {
          token: hashedToken,
          usedAt: null
        }
      });

      if (!resetRecord) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      // Check if token is expired
      if (new Date() > resetRecord.expiresAt) {
        await resetRecord.update({ usedAt: new Date() });
        return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
      }

      // Get user
      const user = await User.findByPk(resetRecord.userId);
      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }

      // Update password (will be hashed by model hook)
      await user.update({ password });

      // Mark token as used
      await resetRecord.update({ usedAt: new Date() });

      res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// @route   GET /api/auth/validate-reset-token/:token
// @desc    Validate if a reset token is still valid
// @access  Public
router.get('/validate-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const resetRecord = await PasswordReset.findOne({
      where: {
        token: hashedToken,
        usedAt: null
      }
    });

    if (!resetRecord || new Date() > resetRecord.expiresAt) {
      return res.json({ valid: false });
    }

    res.json({ valid: true });
  } catch (error) {
    console.error('Validate token error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// Google OAuth Routes
// ==========================================

/**
 * Resolves a Google user profile from either:
 *  - `credential` (ID token JWT, from Google Identity Services button), or
 *  - `accessToken` (OAuth2 access token, from custom OAuth popup flows).
 * Returns: { googleId, email, given_name, family_name, picture } or throws.
 */
async function resolveGoogleProfile({ credential, accessToken }) {
  if (credential) {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const allowedAudiences = [
      process.env.GOOGLE_CLIENT_ID,
      ...(process.env.GOOGLE_CLIENT_IDS || '').split(',').map((value) => value.trim()),
      typeof arguments[0]?.clientId === 'string' ? arguments[0].clientId.trim() : ''
    ].filter(Boolean);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: allowedAudiences
    });
    const p = ticket.getPayload();
    return {
      googleId: p.sub,
      email: p.email,
      given_name: p.given_name,
      family_name: p.family_name,
      picture: p.picture
    };
  }
  if (accessToken) {
    const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!resp.ok) {
      const err = new Error('Invalid Google access token');
      err.status = 401;
      throw err;
    }
    const p = await resp.json();
    return {
      googleId: p.sub,
      email: p.email,
      given_name: p.given_name,
      family_name: p.family_name,
      picture: p.picture
    };
  }
  const err = new Error('Google credential or accessToken is required');
  err.status = 400;
  throw err;
}

// @route   POST /api/auth/google
// @desc    Authenticate with Google OAuth token from frontend
// @access  Public
router.post('/google', async (req, res) => {
  try {
    const { credential, accessToken, clientId } = req.body;

    if (!credential && !accessToken) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    const { googleId, email, given_name, family_name, picture } = await resolveGoogleProfile({ credential, accessToken, clientId });

    if (!email) {
      return res.status(400).json({ error: 'Email not found in Google profile' });
    }

    // Check if user exists by googleId; fall back gracefully when schema lags.
    let user = null;
    try {
      user = await User.findOne({
        where: { googleId },
        attributes: AUTH_SAFE_USER_FIELDS
      });
    } catch (dbErr) {
      if (!isSchemaDriftDbError(dbErr)) throw dbErr;
    }

    if (!user) {
      // Check if user exists by email (link accounts)
      user = await User.findOne({
        where: { email },
        attributes: AUTH_SAFE_USER_FIELDS
      });

      if (user) {
        // Link Google account to existing user
        // Backfill slug for legacy accounts created before slug support shipped.
        const updates = {
          googleId,
          profilePictureUrl: picture || user.profilePictureUrl,
        };
        if (!user.slug) {
          updates.slug = await buildUniqueUserSlug(User, user.firstName, user.lastName, { excludeUserId: user.id });
        }
        try {
          await user.update(updates);
        } catch (dbErr) {
          if (!isSchemaDriftDbError(dbErr)) throw dbErr;
        }
      } else {
        // Create new user
        let slug = null;
        try {
          slug = await buildUniqueUserSlug(User, given_name || 'User', family_name || '');
        } catch (dbErr) {
          if (!isSchemaDriftDbError(dbErr)) throw dbErr;
        }

        try {
          user = await User.create({
            email,
            firstName: given_name || 'User',
            lastName: family_name || '',
            googleId,
            profilePictureUrl: picture,
            role: 'candidate',
            password: null,
            ...(slug ? { slug } : {})
          });
        } catch (dbErr) {
          if (!isSchemaDriftDbError(dbErr)) throw dbErr;
          user = await User.create({
            email,
            firstName: given_name || 'User',
            lastName: family_name || '',
            role: 'candidate',
            password: null,
          });
        }

        // Create empty profile for new candidate
        await Profile.create({
          userId: user.id,
          profilePicture: picture
        });
      }
    } else {
      // Update profile picture if changed
      if (picture && user.profilePictureUrl !== picture) {
        try {
          await user.update({ profilePictureUrl: picture });
        } catch (dbErr) {
          if (!isSchemaDriftDbError(dbErr)) throw dbErr;
        }
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Get profile picture
    let profilePicture = user.profilePictureUrl;
    if (!profilePicture) {
      if (user.role === 'recruiter') {
        const recruiterProfile = await RecruiterProfile.findOne({ where: { userId: user.id } });
        profilePicture = recruiterProfile?.profilePicture || recruiterProfile?.companyLogo;
      } else {
        const profile = await Profile.findOne({ where: { userId: user.id } });
        profilePicture = profile?.profilePicture;
      }
    }

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        slug: user.slug,
        role: user.role,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        profilePicture
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    if (error.message?.includes('payload audience != requiredAudience')) {
      return res.status(401).json({ error: 'Google client ID mismatch' });
    }
    if (error.message?.includes('Token used too late') || error.message?.includes('Invalid token')) {
      return res.status(401).json({ error: 'Invalid or expired Google token' });
    }
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// @route   POST /api/auth/google/register
// @desc    Register with Google OAuth and specify role
// @access  Public
router.post('/google/register', async (req, res) => {
  try {
    const { credential, accessToken, role = 'candidate', clientId } = req.body;

    if (!credential && !accessToken) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    if (!['candidate', 'recruiter'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (role === 'recruiter' && !featureFlags.recruiterSurface) {
      return res.status(403).json({ error: 'Recruiter signup is not available yet.' });
    }

    const { googleId, email, given_name, family_name, picture } = await resolveGoogleProfile({ credential, accessToken, clientId });

    if (!email) {
      return res.status(400).json({ error: 'Email not found in Google profile' });
    }

    // Check if user already exists
    let user = await User.findOne({ 
      where: { 
        [require('sequelize').Op.or]: [
          { googleId },
          { email }
        ]
      },
      attributes: AUTH_SAFE_USER_FIELDS
    });

    if (user) {
      // User exists - just log them in (update googleId if not set)
      // Also backfill slug if the user predates slug support.
      const updates = {};
      if (!user.googleId) {
        updates.googleId = googleId;
        updates.profilePictureUrl = picture;
      }
      if (!user.slug) {
        updates.slug = await buildUniqueUserSlug(User, user.firstName, user.lastName, { excludeUserId: user.id });
      }
      if (Object.keys(updates).length > 0) {
        await user.update(updates);
      }
    } else {
      // Create new user with specified role
      const slug = await buildUniqueUserSlug(User, given_name || 'User', family_name || '');
      user = await User.create({
        email,
        firstName: given_name || 'User',
        lastName: family_name || '',
        googleId,
        profilePictureUrl: picture,
        role,
        password: null,
        slug
      });

      // Create profile based on role
      if (role === 'recruiter') {
        await RecruiterProfile.create({
          userId: user.id,
          profilePicture: picture
        });
      } else {
        await Profile.create({
          userId: user.id,
          profilePicture: picture
        });
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        slug: user.slug,
        role: user.role,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        profilePicture: picture
      }
    });
  } catch (error) {
    console.error('Google register error:', error);
    if (error.message?.includes('payload audience != requiredAudience')) {
      return res.status(401).json({ error: 'Google client ID mismatch' });
    }
    res.status(500).json({ error: 'Google registration failed' });
  }
});

// ==========================================
// GitHub OAuth Routes
// ==========================================

// @route   POST /api/auth/github
// @desc    Authenticate with GitHub OAuth code from frontend
// @access  Public
router.post('/github', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'GitHub authorization code is required' });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(401).json({ error: tokenData.error_description || 'GitHub authentication failed' });
    }

    const accessToken = tokenData.access_token;

    // Get user data from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    const githubUser = await userResponse.json();

    // Get user email (may be private)
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      const emails = await emailsResponse.json();
      const primaryEmail = emails.find(e => e.primary) || emails[0];
      email = primaryEmail?.email;
    }

    if (!email) {
      return res.status(400).json({ error: 'Could not retrieve email from GitHub. Please make your email public.' });
    }

    const githubId = String(githubUser.id);
    const firstName = githubUser.name?.split(' ')[0] || githubUser.login || 'User';
    const lastName = githubUser.name?.split(' ').slice(1).join(' ') || '';
    const picture = githubUser.avatar_url;

    // Check if user exists by githubId
    let user = await User.findOne({ where: { githubId } });

    if (!user) {
      // Check if user exists by email (link accounts)
      user = await User.findOne({ where: { email } });

      if (user) {
        // Link GitHub account to existing user
        await user.update({
          githubId,
          profilePictureUrl: picture || user.profilePictureUrl
        });
      } else {
        // User doesn't exist - return 404 for login, they need to register first
        return res.status(404).json({ error: 'No account found with this GitHub email. Please sign up first.' });
      }
    } else {
      // Update profile picture if changed
      if (picture && user.profilePictureUrl !== picture) {
        await user.update({ profilePictureUrl: picture });
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Get profile picture
    let profilePicture = user.profilePictureUrl;
    if (!profilePicture) {
      if (user.role === 'recruiter') {
        const recruiterProfile = await RecruiterProfile.findOne({ where: { userId: user.id } });
        profilePicture = recruiterProfile?.profilePicture || recruiterProfile?.companyLogo;
      } else {
        const profile = await Profile.findOne({ where: { userId: user.id } });
        profilePicture = profile?.profilePicture;
      }
    }

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        slug: user.slug,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        profilePicture
      }
    });
  } catch (error) {
    console.error('GitHub auth error:', error);
    res.status(500).json({ error: 'GitHub authentication failed' });
  }
});

// @route   POST /api/auth/github/register
// @desc    Register with GitHub OAuth and specify role
// @access  Public
router.post('/github/register', async (req, res) => {
  try {
    const { code, role = 'candidate' } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'GitHub authorization code is required' });
    }

    if (!['candidate', 'recruiter'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (role === 'recruiter' && !featureFlags.recruiterSurface) {
      return res.status(403).json({ error: 'Recruiter signup is not available yet.' });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(401).json({ error: tokenData.error_description || 'GitHub authentication failed' });
    }

    const accessToken = tokenData.access_token;

    // Get user data from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    const githubUser = await userResponse.json();

    // Get user email (may be private)
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      const emails = await emailsResponse.json();
      const primaryEmail = emails.find(e => e.primary) || emails[0];
      email = primaryEmail?.email;
    }

    if (!email) {
      return res.status(400).json({ error: 'Could not retrieve email from GitHub. Please make your email public.' });
    }

    const githubId = String(githubUser.id);
    const firstName = githubUser.name?.split(' ')[0] || githubUser.login || 'User';
    const lastName = githubUser.name?.split(' ').slice(1).join(' ') || '';
    const picture = githubUser.avatar_url;

    // Check if user already exists
    let user = await User.findOne({ 
      where: { 
        [require('sequelize').Op.or]: [
          { githubId },
          { email }
        ]
      }
    });

    if (user) {
      // User exists - just log them in (update githubId if not set)
      // Also backfill slug if the user predates slug support.
      const updates = {};
      if (!user.githubId) {
        updates.githubId = githubId;
        updates.profilePictureUrl = picture;
      }
      if (!user.slug) {
        updates.slug = await buildUniqueUserSlug(User, user.firstName, user.lastName, { excludeUserId: user.id });
      }
      if (Object.keys(updates).length > 0) {
        await user.update(updates);
      }
    } else {
      // Create new user with specified role
      const slug = await buildUniqueUserSlug(User, firstName, lastName);
      user = await User.create({
        email,
        firstName,
        lastName,
        githubId,
        profilePictureUrl: picture,
        role,
        password: null,
        slug
      });

      // Create profile based on role
      if (role === 'recruiter') {
        await RecruiterProfile.create({
          userId: user.id,
          profilePicture: picture
        });
      } else {
        await Profile.create({
          userId: user.id,
          profilePicture: picture
        });
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        slug: user.slug,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        profilePicture: picture
      }
    });
  } catch (error) {
    console.error('GitHub register error:', error);
    res.status(500).json({ error: 'GitHub registration failed' });
  }
});

// ==========================================
// LinkedIn OAuth Routes (OIDC: openid profile email)
// ==========================================

// @route   GET /api/auth/linkedin/authorize-url
// @desc    Build a LinkedIn OAuth authorization URL using server-side
//          credentials, so the frontend doesn't need its own client ID.
// @access  Public
router.get('/linkedin/authorize-url', (req, res) => {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ error: 'LinkedIn sign-in is not configured.' });
  }
  const { redirectUri, state } = req.query;
  if (!redirectUri || !state) {
    return res.status(400).json({ error: 'redirectUri and state are required' });
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: String(redirectUri),
    scope: 'openid profile email',
    state: String(state),
  });
  res.json({ url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}` });
});

// Exchange a LinkedIn authorization code for an access token + OIDC userinfo.
async function fetchLinkedInProfile(code, redirectUri) {
  const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || ''
    })
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || tokenData.error) {
    const err = new Error(tokenData.error_description || tokenData.error || 'LinkedIn token exchange failed');
    err.status = 401;
    throw err;
  }

  const userinfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const profile = await userinfoResponse.json();
  if (!userinfoResponse.ok) {
    const err = new Error(profile.message || 'Failed to load LinkedIn profile');
    err.status = 401;
    throw err;
  }

  return {
    linkedinId: String(profile.sub),
    email: profile.email,
    firstName: profile.given_name || profile.name?.split(' ')[0] || 'User',
    lastName: profile.family_name || profile.name?.split(' ').slice(1).join(' ') || '',
    picture: profile.picture || null
  };
}

// @route   POST /api/auth/linkedin
// @desc    Authenticate with LinkedIn OAuth code from frontend
// @access  Public
router.post('/linkedin', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'LinkedIn authorization code and redirectUri are required' });
    }

    const { linkedinId, email, picture } = await fetchLinkedInProfile(code, redirectUri);

    if (!email) {
      return res.status(400).json({ error: 'Could not retrieve email from LinkedIn.' });
    }

    let user = await User.findOne({ where: { linkedinId } });

    if (!user) {
      user = await User.findOne({ where: { email } });

      if (user) {
        await user.update({
          linkedinId,
          profilePictureUrl: picture || user.profilePictureUrl
        });
      } else {
        return res.status(404).json({ error: 'No account found with this LinkedIn email. Please sign up first.' });
      }
    } else if (picture && user.profilePictureUrl !== picture) {
      await user.update({ profilePictureUrl: picture });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    let profilePicture = user.profilePictureUrl;
    if (!profilePicture) {
      if (user.role === 'recruiter') {
        const recruiterProfile = await RecruiterProfile.findOne({ where: { userId: user.id } });
        profilePicture = recruiterProfile?.profilePicture || recruiterProfile?.companyLogo;
      } else {
        const profile = await Profile.findOne({ where: { userId: user.id } });
        profilePicture = profile?.profilePicture;
      }
    }

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        slug: user.slug,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        profilePicture
      }
    });
  } catch (error) {
    console.error('LinkedIn auth error:', error);
    res.status(error.status || 500).json({ error: error.message || 'LinkedIn authentication failed' });
  }
});

// @route   POST /api/auth/linkedin/register
// @desc    Register with LinkedIn OAuth and specify role
// @access  Public
router.post('/linkedin/register', async (req, res) => {
  try {
    const { code, redirectUri, role = 'candidate' } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'LinkedIn authorization code and redirectUri are required' });
    }

    if (!['candidate', 'recruiter'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (role === 'recruiter' && !featureFlags.recruiterSurface) {
      return res.status(403).json({ error: 'Recruiter signup is not available yet.' });
    }

    const { linkedinId, email, firstName, lastName, picture } = await fetchLinkedInProfile(code, redirectUri);

    if (!email) {
      return res.status(400).json({ error: 'Could not retrieve email from LinkedIn.' });
    }

    let user = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [{ linkedinId }, { email }]
      }
    });

    if (user) {
      const updates = {};
      if (!user.linkedinId) {
        updates.linkedinId = linkedinId;
        updates.profilePictureUrl = picture;
      }
      if (!user.slug) {
        updates.slug = await buildUniqueUserSlug(User, user.firstName, user.lastName, { excludeUserId: user.id });
      }
      if (Object.keys(updates).length > 0) {
        await user.update(updates);
      }
    } else {
      const slug = await buildUniqueUserSlug(User, firstName, lastName);
      user = await User.create({
        email,
        firstName,
        lastName,
        linkedinId,
        profilePictureUrl: picture,
        role,
        password: null,
        slug
      });

      if (role === 'recruiter') {
        await RecruiterProfile.create({ userId: user.id, profilePicture: picture });
      } else {
        await Profile.create({ userId: user.id, profilePicture: picture });
      }
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        slug: user.slug,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        profilePicture: picture
      }
    });
  } catch (error) {
    console.error('LinkedIn register error:', error);
    res.status(error.status || 500).json({ error: error.message || 'LinkedIn registration failed' });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Confirm a user's email using the token from their inbox
// @access  Public
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const submitted = token.trim();
    const normalizedCode = submitted.replace(/\D/g, '');

    let user = null;
    if (normalizedCode.length === 6) {
      user = await User.findOne({ where: { emailVerificationCode: normalizedCode } });
    }

    if (!user) {
      const hashed = crypto.createHash('sha256').update(submitted).digest('hex');
      user = await User.findOne({ where: { emailVerificationToken: hashed } });
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification link/code.' });
    }

    if (user.emailVerified) {
      return res.json({ message: 'Email already verified.', emailVerified: true });
    }

    if (!user.emailVerificationExpiresAt || new Date() > user.emailVerificationExpiresAt) {
      return res.status(400).json({ error: 'This verification link has expired. Please request a new one.' });
    }

    await user.update({
      emailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationCode: null,
      emailVerificationExpiresAt: null
    });

    res.json({ message: 'Email verified successfully.', emailVerified: true });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/auth/resend-verification
// @desc    Resend the email verification link to the authenticated user
// @access  Private
router.post('/resend-verification', resendVerificationLimiter, auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.emailVerified) {
      return res.json({ message: 'Email is already verified.' });
    }

    const verificationTokenRaw = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(verificationTokenRaw).digest('hex');
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await user.update({
      emailVerificationToken: verificationTokenHash,
      emailVerificationCode: verificationCode,
      emailVerificationExpiresAt: verificationExpiresAt
    });

    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${verificationTokenRaw}`;
    const sent = await sendEmailVerification(user.email, user.firstName, verifyUrl, verificationCode);
    if (!sent) {
      return res.status(500).json({ error: 'Could not send verification email. Configure EMAIL_* or RESEND_API_KEY in backend/.env.' });
    }

    const response = { message: 'Verification email sent.' };
    if (process.env.NODE_ENV !== 'production') {
      response.verifyUrl = verifyUrl;
    }

    res.json(response);
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
