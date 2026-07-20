const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * BookmarkletToken — a long-lived credential embedded in the URL of a
 * user's saved "ProfileAI" bookmarklet, so it can call the API directly
 * from an arbitrary job-site origin (linkedin.com, myworkdayjobs.com, ...)
 * where the normal JWT-in-localStorage auth isn't reachable.
 *
 * The raw token is shown to the user exactly once at mint time (like an
 * API key) and only its SHA-256 hash is stored, mirroring PasswordReset.
 * Revocation is soft (revokedAt) so usage history survives for abuse review.
 */
const BookmarkletToken = sequelize.define('BookmarkletToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  tokenHash: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'SHA256 hex digest of the raw bookmarklet token'
  },
  // User-facing label so the "connected devices" settings list is legible,
  // e.g. "iOS Safari" / "Android Chrome". Defaults to a generic name.
  label: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Mobile bookmarklet'
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Last job-site origin the token was used from — surfaced in settings so
  // a user (or us, reviewing abuse) can sanity-check where it's active.
  lastUsedOrigin: {
    type: DataTypes.STRING,
    allowNull: true
  },
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'BookmarkletTokens',
  indexes: [
    { fields: ['userId'] },
    { unique: true, fields: ['tokenHash'] }
  ]
});

module.exports = BookmarkletToken;
