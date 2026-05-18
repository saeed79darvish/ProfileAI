const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Project = sequelize.define('Project', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  recruiterId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  department: {
    type: DataTypes.STRING,
    allowNull: true
  },
  employmentType: {
    type: DataTypes.ENUM('full-time', 'part-time', 'contract', 'internship', 'temporary'),
    defaultValue: 'full-time'
  },
  workMode: {
    type: DataTypes.ENUM('remote', 'hybrid', 'onsite'),
    defaultValue: 'hybrid'
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  salaryRange: {
    type: DataTypes.JSONB,
    defaultValue: {
      min: 0,
      max: 0,
      currency: 'USD'
    }
  },
  requiredSkills: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  preferredSkills: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  experienceLevel: {
    type: DataTypes.ENUM('entry', 'junior', 'mid', 'senior', 'lead', 'executive'),
    defaultValue: 'mid'
  },
  educationRequirement: {
    type: DataTypes.STRING,
    allowNull: true
  },
  responsibilities: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  benefits: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  companyValues: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'paused', 'closed', 'filled'),
    defaultValue: 'draft'
  },
  numberOfPositions: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: true
  },
  aiMatchedCandidates: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  aiRecommendations: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  analytics: {
    type: DataTypes.JSONB,
    defaultValue: {
      views: 0,
      applications: 0,
      shortlisted: 0,
      interviewed: 0,
      hired: 0
    }
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true
});

module.exports = Project;
