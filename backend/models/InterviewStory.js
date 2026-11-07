const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** A behavioral story a candidate prepared for an interview (per user, private). */
const InterviewStory = sequelize.define('InterviewStory', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  prepId: { type: DataTypes.UUID, allowNull: true },
  tailoredProfileId: { type: DataTypes.UUID, allowNull: true },
  company: { type: DataTypes.STRING, allowNull: true },
  role: { type: DataTypes.STRING, allowNull: true },
  theme: { type: DataTypes.STRING, allowNull: true },
  title: { type: DataTypes.STRING, allowNull: true },
  spoken: { type: DataTypes.TEXT, allowNull: true },
  beats: { type: DataTypes.JSONB, allowNull: true },
  tips: { type: DataTypes.JSONB, allowNull: true },
  needsYou: { type: DataTypes.JSONB, allowNull: true },
  experienceRef: { type: DataTypes.JSONB, allowNull: true },
}, {
  tableName: 'InterviewStories',
  timestamps: true,
  indexes: [{ fields: ['userId', 'prepId'], name: 'interview_stories_user_prep' }],
});

module.exports = InterviewStory;
