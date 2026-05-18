const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExternalApplication = sequelize.define('ExternalApplication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  // Job info scraped from the page
  jobTitle: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  company: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  jobUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'e.g. LinkedIn, Greenhouse, Lever, Workday',
  },
  // Application status
  status: {
    type: DataTypes.ENUM(
      'applied',
      'screening',
      'interviewing',
      'offer',
      'rejected',
      'withdrawn',
      'no_response'
    ),
    defaultValue: 'applied',
  },
  appliedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  // Optional metadata
  salary: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  jobType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'e.g. Full-time, Part-time, Contract',
  },
  locationType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'e.g. Remote, Hybrid, On-site',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // What was used to apply
  tailoredProfileId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'TailoredProfiles',
      key: 'id',
    },
  },
  resumeUsed: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  coverLetterUsed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // AI match data from extension
  matchScore: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 0, max: 100 },
  },
}, {
  tableName: 'ExternalApplications',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['status'] },
    { fields: ['appliedAt'] },
    { fields: ['userId', 'jobUrl'], unique: true },
  ],
});

module.exports = ExternalApplication;
