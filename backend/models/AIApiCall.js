const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * One row per call to an AI provider (Anthropic, OpenAI). Unlike AIUsage,
 * which counts feature uses against plan limits, this records what the call
 * actually cost us: real tokens from the provider's response and cost computed
 * from config/aiPricing.js at write time.
 *
 * userId is null for guests and background jobs (embeddings, ingestion).
 */
const AIApiCall = sequelize.define('AIApiCall', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: true },
  provider: { type: DataTypes.STRING(20), allowNull: false },
  model: { type: DataTypes.STRING(80), allowNull: false },
  operation: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'chat' },
  feature: { type: DataTypes.STRING(60), allowNull: true },
  route: { type: DataTypes.STRING(120), allowNull: true },
  inputTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  outputTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  cacheReadTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  cacheWriteTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  costUsd: { type: DataTypes.DECIMAL(12, 6), allowNull: false, defaultValue: 0 },
  priced: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  latencyMs: { type: DataTypes.INTEGER, allowNull: true },
  status: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'ok' },
  error: { type: DataTypes.STRING(300), allowNull: true },
}, {
  tableName: 'AIApiCalls',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['createdAt'] },
    { fields: ['userId', 'createdAt'] },
    { fields: ['provider', 'model', 'createdAt'] },
    { fields: ['feature', 'createdAt'] },
  ],
});

module.exports = AIApiCall;
