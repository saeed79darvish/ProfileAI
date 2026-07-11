const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Server-side cache of LinkedIn profile analyses. Shared by the authed and
 * guest analyzer routes so we never pay for the same Claude call twice
 * within the TTL window.
 *
 * Key strategy:
 *   cacheKey = `${profileUrlKey}:${sha256(scrapedPayloadCanonical)}`
 * so a profile analyzed twice with materially the same content only hits
 * Claude once — but a profile whose About or Experience changed produces a
 * distinct hash and re-scores fresh.
 *
 * `analysisJson` always stores the FULL AI output. Guest responses filter it
 * server-side into a teaser shape; the full report is only released via
 * signed-in access or the email-capture flow, so the raw JSON must never be
 * sent to unauthenticated clients directly.
 */
const GuestAnalysisCache = sequelize.define('GuestAnalysisCache', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  cacheKey: {
    type: DataTypes.STRING(600),
    allowNull: false,
    unique: true,
  },
  profileUrlKey: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  scrapedPayloadHash: {
    type: DataTypes.STRING(64), // sha256 hex
    allowNull: false,
  },
  analysisJson: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  targetTitle: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  modelUsed: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  producedByUserId: {
    // NULL when this cache row was created by a guest request. Non-null when
    // an authed user was the first to generate it — useful for audit/debug.
    type: DataTypes.UUID,
    allowNull: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'GuestAnalysisCaches',
  timestamps: true,
  indexes: [
    { fields: ['cacheKey'], unique: true },
    { fields: ['profileUrlKey'] },
    { fields: ['expiresAt'] },
  ],
});

module.exports = GuestAnalysisCache;
