const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Guest AI usage — one row per unauthenticated LinkedIn Profile Analyzer
 * request. Powers the anti-abuse rate limits for the guest teaser flow:
 *   - max 3 analyses per IP per rolling 24h
 *   - max 2 analyses per profile URL per rolling 24h (globally)
 *
 * IPs are stored as a SHA-256 hash with a per-instance server salt so we can
 * count them without ever persisting the raw address (privacy + GDPR).
 * ProfileUrlKey is the normalized origin+pathname (no query/hash), matching
 * the extension's client-side cache key format.
 */
const GuestAIUsage = sequelize.define('GuestAIUsage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ipHash: {
    type: DataTypes.STRING(64), // sha256 hex
    allowNull: false,
  },
  profileUrlKey: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  analysisCacheId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  emailCaptured: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  cacheHit: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  userAgent: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'GuestAIUsages',
  timestamps: true,
  indexes: [
    { fields: ['ipHash', 'createdAt'] },
    { fields: ['profileUrlKey', 'createdAt'] },
    { fields: ['analysisCacheId'] },
  ],
});

module.exports = GuestAIUsage;
