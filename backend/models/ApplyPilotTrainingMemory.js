const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * ApplyPilotTrainingMemory — the structured, editable "What the agent
 * knows about me" rows on the Training page.
 *
 * Separate from the chat log (ApplyPilotTrainingMessage) because these
 * are the distilled facts Claude is quoted from when drafting custom
 * answers, while the chat is the raw conversation.
 */
const ApplyPilotTrainingMemory = sequelize.define('ApplyPilotTrainingMemory', {
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
  // 'motive' | 'stories' | 'values' | 'limits' | 'voice'
  topic: { type: DataTypes.STRING, allowNull: false },
  // Human-friendly label — "Motivation", "Dealbreaker", "Story · $40M/day".
  key: { type: DataTypes.STRING, allowNull: false },
  // The fact itself. May contain quoted user phrasing.
  value: { type: DataTypes.TEXT, allowNull: false },
  // Source: 'chat' (distilled from a training interview turn),
  // 'manual' (user edited directly), 'system' (bootstrapped from profile).
  source: {
    type: DataTypes.ENUM('chat', 'manual', 'system'),
    defaultValue: 'chat',
  },
  // Used by the prep worker to pick the most relevant memory rows
  // when drafting an answer. Claude returns embeddings via a later call.
  embedding: { type: DataTypes.ARRAY(DataTypes.FLOAT), allowNull: true },
}, {
  timestamps: true,
  tableName: 'ApplyPilotTrainingMemories',
  indexes: [
    { fields: ['userId'], name: 'idx_applypilot_mem_user' },
    { fields: ['userId', 'topic'], name: 'idx_applypilot_mem_user_topic' },
  ],
});

module.exports = ApplyPilotTrainingMemory;
