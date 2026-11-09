const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** One reviewed answer to a coding question on an interview prep. The code is what the candidate typed; it is never run. */
const InterviewCodeAttempt = sequelize.define('InterviewCodeAttempt', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  prepId: { type: DataTypes.UUID, allowNull: false },
  question: { type: DataTypes.TEXT, allowNull: false },
  language: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'javascript' },
  code: { type: DataTypes.TEXT, allowNull: false },
  review: { type: DataTypes.JSONB, allowNull: true },
}, {
  tableName: 'InterviewCodeAttempts',
  timestamps: true,
  indexes: [{ fields: ['userId', 'prepId'], name: 'interview_code_user_prep' }],
});

module.exports = InterviewCodeAttempt;
