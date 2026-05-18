const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TailoredProfile = sequelize.define('TailoredProfile', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  jobTitle: {
    type: DataTypes.STRING,
    allowNull: false
  },
  jobUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Source of this tailored version: manual profile flow or ApplyPilot sync.
  source: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'manual'
  },
  // When sourced from ApplyPilot, link back to the originating application.
  applyPilotApplicationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'ApplyPilotApplications',
      key: 'id'
    }
  },
  // Provenance blob used by UI ribbons and deep-links.
  sourceMeta: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: null
  },
  applyPilotSyncedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Store the complete tailored profile as JSONB
  tailoredData: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  // Snapshot of original profile at time of tailoring
  originalProfileSnapshot: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: null
  },
  // Match score from AI analysis
  matchScore: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // Skill gaps identified during tailoring
  // Array of { skill, category, severity, description, learningResource, status }
  // status: 'pending' | 'in_progress' | 'learned'
  skillGaps: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: []
  },
  // Learning plan derived from accepted skill gaps
  // { acceptedGaps: string[], skippedGaps: string[], createdAt: date }
  learningPlan: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: null
  },
  // User notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Soft delete
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'TailoredProfiles',
  timestamps: true,
  indexes: [
    { fields: ['userId'], name: 'idx_tailored_profile_user' },
    { fields: ['applyPilotApplicationId'], name: 'idx_tailored_profile_applypilot_app' },
    { fields: ['userId', 'companyName', 'jobTitle'], name: 'idx_tailored_profile_user_company_role' }
  ]
});

module.exports = TailoredProfile;
