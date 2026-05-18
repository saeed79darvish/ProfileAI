const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RecruiterATSIntegration = sequelize.define('RecruiterATSIntegration', {
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
    },
    onDelete: 'CASCADE'
  },
  platform: {
    type: DataTypes.ENUM('greenhouse'),
    allowNull: false
  },
  apiKeyEncrypted: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'AES-256-GCM encrypted API key'
  },
  label: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastSyncAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  jobCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  syncError: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'RecruiterATSIntegrations',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'platform']
    },
    { fields: ['isActive'] }
  ]
});

module.exports = RecruiterATSIntegration;
