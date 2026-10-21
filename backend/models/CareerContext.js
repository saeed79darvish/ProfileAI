/**
 * CareerContext — what ProfilleAI knows about a candidate beyond the resume.
 *
 * The coach learns things a resume never says: the role someone is aiming
 * for, why, what they think is in the way, where and how they want to work.
 * Until this existed all of it lived in the browser conversation and was
 * gone after sign-up, so the next session asked again and nothing else in
 * the product could use it.
 *
 * One row per user. The person can see, edit and delete every field from
 * their profile ("What ProfilleAI knows about you"). Conversations are kept
 * only as short written summaries, never audio or a raw transcript.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CareerContext = sequelize.define('CareerContext', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE',
  },
  // The role they are aiming for next, in their words.
  target: { type: DataTypes.STRING(200), allowNull: true },
  targetWhy: { type: DataTypes.TEXT, allowNull: true },
  targetBlocker: { type: DataTypes.TEXT, allowNull: true },
  /* Practical limits on the search: { location, workStyle, roleTypes,
     salary, noticePeriod }. Only what they said; nothing inferred. */
  constraints: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  // The coach's read on how far the target is ({ verdict, headline, why, closes }).
  assessment: { type: DataTypes.JSONB, allowNull: true },
  // [{ at, source: 'call' | 'chat', text }], newest last, capped.
  summaries: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
}, {
  tableName: 'CareerContexts',
  timestamps: true,
  indexes: [{ unique: true, fields: ['userId'] }],
});

module.exports = CareerContext;
