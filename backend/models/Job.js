const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Job = sequelize.define('Job', {
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
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  company: {
    type: DataTypes.STRING,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false
  },
  locationType: {
    type: DataTypes.ENUM('remote', 'hybrid', 'onsite'),
    defaultValue: 'onsite'
  },
  employmentType: {
    type: DataTypes.ENUM('full-time', 'part-time', 'contract', 'internship', 'freelance'),
    defaultValue: 'full-time'
  },
  experienceLevel: {
    type: DataTypes.ENUM('entry', 'mid', 'senior', 'lead', 'executive'),
    defaultValue: 'mid'
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
    type: DataTypes.ENUM('hourly', 'monthly', 'yearly'),
    defaultValue: 'yearly'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  requirements: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  benefits: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  skills: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  department: {
    type: DataTypes.STRING,
    allowNull: true
  },
  applicationDeadline: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'paused', 'closed'),
    defaultValue: 'active'
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  applications: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  applicationQuestions: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Custom application form questions and standard fields'
  }
}, {
  timestamps: true,
  tableName: 'Jobs',
  indexes: [
    { fields: ['status'] },
    { fields: ['userId'] },
    { fields: ['status', 'featured', 'createdAt'] },
    { fields: ['title'] },
    { fields: ['company'] },
  ]
});

module.exports = Job;
