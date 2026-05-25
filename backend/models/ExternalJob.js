const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExternalJob = sequelize.define('ExternalJob', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  externalId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Unique ID from the source ATS (e.g., Greenhouse job ID, Lever posting ID)'
  },
  source: {
    type: DataTypes.ENUM('greenhouse', 'lever', 'ashby', 'remoteok', 'adzuna', 'jsearch', 'theirstack', 'wwr', 'manual', 'amazon', 'hn_hiring'),
    allowNull: false
  },
  boardToken: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'The company board token/slug used to fetch this job'
  },
  title: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  company: {
    type: DataTypes.STRING,
    allowNull: false
  },
  location: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  locationType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'remote, hybrid, onsite'
  },
  employmentType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'full-time, part-time, contract, internship'
  },
  experienceLevel: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'entry, mid, senior, lead, executive'
  },
  department: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  descriptionHtml: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  requirements: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  skills: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  salaryMin: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  salaryMax: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  salaryCurrency: {
    type: DataTypes.STRING,
    defaultValue: 'USD'
  },
  salaryPeriod: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'hourly, monthly, yearly, per-year-salary'
  },
  applyUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Direct URL to apply on the company ATS'
  },
  sourceUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'URL to view the job posting on the ATS'
  },
  postedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastFetchedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Raw ATS response data for reference'
  },
  embedding: {
    type: DataTypes.VECTOR(512),
    allowNull: true,
    comment: 'OpenAI text-embedding-3-small vector for semantic search'
  },
  embeddingUpdatedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'ExternalJobs',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['source', 'externalId']
    },
    { fields: ['isActive'] },
    { fields: ['postedAt'] },
    { fields: ['source'] },
    { fields: ['company'] },
    { fields: ['boardToken'] },
    { fields: ['companyId'] }
  ]
});

module.exports = ExternalJob;
