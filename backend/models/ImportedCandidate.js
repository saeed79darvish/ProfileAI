const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ImportedCandidate = sequelize.define('ImportedCandidate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  importId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'CandidateImports',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  profileId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Profiles',
      key: 'id'
    },
    onDelete: 'SET NULL'
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'SET NULL'
  },
  // Original data from import source
  sourceData: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  // Parsed/normalized candidate data
  firstName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  linkedinUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  resumeUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  currentTitle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  currentCompany: {
    type: DataTypes.STRING,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Enrichment fields
  enrichmentStatus: {
    type: DataTypes.ENUM('none', 'pending', 'in_progress', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'none'
  },
  enrichedData: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  },
  enrichedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Import status
  importStatus: {
    type: DataTypes.ENUM('pending', 'success', 'duplicate', 'invalid', 'failed'),
    allowNull: false,
    defaultValue: 'pending'
  },
  duplicateOfProfileId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  validationErrors: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: []
  },
  // Row number for CSV imports (useful for error reporting)
  sourceRowNumber: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'ImportedCandidates',
  indexes: [
    {
      name: 'idx_imported_candidates_import',
      fields: ['importId']
    },
    {
      name: 'idx_imported_candidates_profile',
      fields: ['profileId']
    },
    {
      name: 'idx_imported_candidates_user',
      fields: ['userId']
    },
    {
      name: 'idx_imported_candidates_status',
      fields: ['importStatus']
    },
    {
      name: 'idx_imported_candidates_enrichment',
      fields: ['enrichmentStatus']
    },
    {
      name: 'idx_imported_candidates_email',
      fields: ['email']
    },
    {
      name: 'idx_imported_candidates_linkedin',
      fields: ['linkedinUrl']
    }
  ]
});

module.exports = ImportedCandidate;
