const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** One spoken practice run on an interview prep. Text notes only: audio and transcripts are never stored. */
const InterviewPracticeSession = sequelize.define('InterviewPracticeSession', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  prepId: { type: DataTypes.UUID, allowNull: false },
  startedAt: { type: DataTypes.DATE, allowNull: true },
  seconds: { type: DataTypes.INTEGER, allowNull: true },
  notes: { type: DataTypes.JSONB, allowNull: true },
  summary: { type: DataTypes.TEXT, allowNull: true },
  topTip: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'InterviewPracticeSessions',
  timestamps: true,
  indexes: [{ fields: ['userId', 'prepId'], name: 'interview_practice_user_prep' }],
});

module.exports = InterviewPracticeSession;
