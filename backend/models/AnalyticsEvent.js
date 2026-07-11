const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Lightweight analytics event log — in-house replacement for a full vendor
 * (PostHog / Amplitude) until we need one. Every event is a single row with
 * a name, an optional session or user id, and a JSONB properties bag.
 *
 * Powers the LinkedIn Profile Analyzer guest funnel today:
 *   guest_analysis_started, guest_analysis_completed, teaser_viewed,
 *   email_submitted, signin_clicked_from_teaser
 *
 * Kept intentionally thin — indexed by name+createdAt for time-window
 * queries, sessionId for funnel joins, userId for post-conversion analysis.
 */
const AnalyticsEvent = sequelize.define('AnalyticsEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  sessionId: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  properties: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
  },
  ipHash: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
}, {
  tableName: 'AnalyticsEvents',
  timestamps: true,
  indexes: [
    { fields: ['name', 'createdAt'] },
    { fields: ['sessionId'] },
    { fields: ['userId'] },
  ],
});

module.exports = AnalyticsEvent;
