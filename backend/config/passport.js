const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const { User, Profile, RecruiterProfile } = require('../models');

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5001/api/auth/google/callback',
    scope: ['profile', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Extract profile data
      const email = profile.emails?.[0]?.value;
      const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User';
      const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';
      const profilePicture = profile.photos?.[0]?.value;

      if (!email) {
        return done(new Error('No email found in Google profile'), null);
      }

      // Check if user exists by googleId
      let user = await User.findOne({ where: { googleId: profile.id } });

      if (user) {
        // Update profile picture if changed
        if (profilePicture && user.profilePictureUrl !== profilePicture) {
          await user.update({ profilePictureUrl: profilePicture });
        }
        return done(null, user);
      }

      // Check if user exists by email (link accounts)
      user = await User.findOne({ where: { email } });

      if (user) {
        // Link Google account to existing user
        await user.update({
          googleId: profile.id,
          profilePictureUrl: profilePicture || user.profilePictureUrl
        });
        return done(null, user);
      }

      // Create new user
      user = await User.create({
        email,
        firstName,
        lastName,
        googleId: profile.id,
        profilePictureUrl: profilePicture,
        role: 'candidate', // Default role for OAuth users
        password: null // No password for OAuth users
      });

      // Create empty profile for new candidate
      await Profile.create({
        userId: user.id,
        profilePicture: profilePicture
      });

      return done(null, user);
    } catch (error) {
      console.error('Google OAuth error:', error);
      return done(error, null);
    }
  }));
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:5001/api/auth/github/callback',
    scope: ['user:email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Extract profile data
      const email = profile.emails?.[0]?.value;
      const firstName = profile.displayName?.split(' ')[0] || profile.username || 'User';
      const lastName = profile.displayName?.split(' ').slice(1).join(' ') || '';
      const profilePicture = profile.photos?.[0]?.value;

      if (!email) {
        return done(new Error('No email found in GitHub profile. Please make your email public on GitHub.'), null);
      }

      // Check if user exists by githubId
      let user = await User.findOne({ where: { githubId: profile.id } });

      if (user) {
        // Update profile picture if changed
        if (profilePicture && user.profilePictureUrl !== profilePicture) {
          await user.update({ profilePictureUrl: profilePicture });
        }
        return done(null, user);
      }

      // Check if user exists by email (link accounts)
      user = await User.findOne({ where: { email } });

      if (user) {
        // Link GitHub account to existing user
        await user.update({
          githubId: profile.id,
          profilePictureUrl: profilePicture || user.profilePictureUrl
        });
        return done(null, user);
      }

      // Create new user
      user = await User.create({
        email,
        firstName,
        lastName,
        githubId: profile.id,
        profilePictureUrl: profilePicture,
        role: 'candidate', // Default role for OAuth users
        password: null // No password for OAuth users
      });

      // Create empty profile for new candidate
      await Profile.create({
        userId: user.id,
        profilePicture: profilePicture
      });

      return done(null, user);
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      return done(error, null);
    }
  }));
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
