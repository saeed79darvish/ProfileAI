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
  // Direct link to the ExternalJob the user applied to, set when the row is
  // created from a click on an in-app external-job card ("Apply Now"). Gives an
  // EXACT match for the "Applied" badge instead of the fuzzy jobUrl comparison,
  // and survives tracking-param drift. Null for extension/manual rows that have
  // no corresponding ExternalJob in our corpus. Column added by
  // scripts/migrations/addExternalApplicationJobLink.js.
  externalJobId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'ExternalJobs',
      key: 'id',
    },
    onDelete: 'SET NULL',
  },
}, {
  tableName: 'ExternalApplications',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['status'] },
    { fields: ['appliedAt'] },
    { fields: ['userId', 'jobUrl'], unique: true },
    // One application row per (user, externalJob). Partial so it only applies
    // to the click-tracked rows (externalJobId set); extension/manual rows with
    // NULL externalJobId are unaffected. Makes record-on-click idempotent.
    {
      unique: true,
      fields: ['userId', 'externalJobId'],
      name: 'external_applications_user_external_job_unique',
      where: { externalJobId: { [require('sequelize').Op.ne]: null } },
    },
  ],
});

module.exports = ExternalApplication;
