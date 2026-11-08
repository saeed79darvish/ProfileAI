const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** Which shared interview preps a user has opened (their history). Points at InterviewPreps; holds no research. */
const UserInterviewPrep = sequelize.define('UserInterviewPrep', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  prepId: { type: DataTypes.UUID, allowNull: false },
  tailoredProfileId: { type: DataTypes.UUID, allowNull: true },
  source: { type: DataTypes.STRING, allowNull: true }, // tailored | link | text | role
  label: { type: DataTypes.STRING, allowNull: true },
  lastOpenedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'UserInterviewPreps',
  timestamps: true,
  indexes: [{ unique: true, fields: ['userId', 'prepId'], name: 'user_interview_preps_user_prep_unique' }],
});

module.exports = UserInterviewPrep;
