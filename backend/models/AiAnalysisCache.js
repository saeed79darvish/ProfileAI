const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Server-side cache of per-user AI analyses (currently the job Match Analysis /
 * skill-gap report).
 *
 * WHY
 * ---
 * Re-opening a job re-ran the whole analysis: several seconds of Claude latency
 * AND another decrement of the user's AI quota, for an answer that could not
 * have changed. A candidate comparing five roles and clicking back and forth
 * could burn their monthly allowance re-deriving reports they had already seen.
 *
 * KEY STRATEGY
 * ------------
 *   cacheKey = `${kind}:${userId}:${sha256(profileSnapshot + jobDescription)}`
 *
 * Hashing the PROFILE as well as the job is what makes this safe to serve
 * indefinitely: edit your skills or experience and the hash changes, so the
 * next analysis is computed fresh rather than handing back a stale verdict
 * based on who you used to be. Same job + same profile can only produce the
 * same answer, so serving it from cache is not a shortcut, it is the correct
 * result.
 *
 * Mirrors GuestAnalysisCache, which does the same for LinkedIn analyses.
 */
const AiAnalysisCache = sequelize.define('AiAnalysisCache', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  cacheKey: {
    type: DataTypes.STRING(200),
    allowNull: false,
    unique: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Owner of the analysis. Null only for system-level entries.',
  },
  kind: {
    type: DataTypes.STRING(40),
    allowNull: false,
    comment: "Which analysis this is, e.g. 'analyze_gaps'.",
  },
  inputHash: {
    type: DataTypes.STRING(64), // sha256 hex
    allowNull: false,
    comment: 'Hash of the exact inputs (profile snapshot + job text) that produced resultJson.',
  },
  resultJson: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  hitCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'How many times this entry was served instead of calling the model.',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'AiAnalysisCaches',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['cacheKey'] },
    { fields: ['userId', 'kind'] },
    { fields: ['expiresAt'] },
  ],
});

module.exports = AiAnalysisCache;
