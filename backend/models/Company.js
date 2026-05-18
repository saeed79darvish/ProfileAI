const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Company = sequelize.define('Company', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false
  },
  domain: {
    type: DataTypes.STRING,
    allowNull: true
  },
  logoUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  website: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  industry: {
    type: DataTypes.STRING,
    allowNull: true
  },
  employeeCount: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  employeeRange: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fundingStage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  headquarters: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  linkedinUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'Companies',
  timestamps: true,
  indexes: [
    { fields: ['slug'], unique: true },
    { fields: ['domain'] },
    { fields: ['name'] }
  ]
});

module.exports = Company;
