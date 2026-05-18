const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * ApplyPilotTrainingMessage — chat log of the Agent Coach interview.
 * Each row is one message (AI question or user answer). The whole log
 * is replayed when the Training page loads so the user picks up where
 * they left off.
 */
const ApplyPilotTrainingMessage = sequelize.define('ApplyPilotTrainingMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE',
  },
  // 'ai' (the coach) or 'me' (the user).
  role: {
    type: DataTypes.ENUM('ai', 'me'),
    allowNull: false,
  },
  // Optional topic chip shown above an AI message ("Stories · 3 of 6").
  topic: { type: DataTypes.STRING, allowNull: true },
  // Plain text or lightly-marked HTML (sanitized client-side).
  content: { type: DataTypes.TEXT, allowNull: false },
}, {
  timestamps: true,
  tableName: 'ApplyPilotTrainingMessages',
  indexes: [
    { fields: ['userId'], name: 'idx_applypilot_msg_user' },
    { fields: ['userId', 'createdAt'], name: 'idx_applypilot_msg_user_time' },
  ],
});

module.exports = ApplyPilotTrainingMessage;
