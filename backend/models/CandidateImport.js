const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CandidateImport = sequelize.define('CandidateImport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  jobId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Jobs',
      key: 'id'
    },
    onDelete: 'SET NULL'
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
  importType: {
    type: DataTypes.ENUM('csv', 'linkedin', 'email', 'ats', 'api', 'manual'),
    allowNull: false,
    defaultValue: 'csv'
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  totalCandidates: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  processedCandidates: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  successfulImports: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  failedImports: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  duplicatesFound: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  errorLog: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: []
  },
  importOptions: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'CandidateImports',
  indexes: [
    {
      name: 'idx_candidate_imports_recruiter',
      fields: ['recruiterId']
    },
    {
      name: 'idx_candidate_imports_job',
      fields: ['jobId']
    },
    {
      name: 'idx_candidate_imports_status',
      fields: ['status']
    },
    {
      name: 'idx_candidate_imports_created',
      fields: ['createdAt']
    }
  ]
});

module.exports = CandidateImport;
