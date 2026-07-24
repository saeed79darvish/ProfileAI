const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Admin-curated company blocklist for the external-jobs corpus. Covers the
 * "we need a delete function to remove scam jobs" gap: no scam/spam detector
 * exists, so this is the manual lever — an admin blocks a company by name and
 * (a) syncBoard skips it going forward (see externalJobService.isCompanyBlocked),
 * (b) the block endpoint immediately deactivates any of its existing boards +
 * jobs so the effect is instant, not just future-facing.
 *
 * Matched case-insensitively against ATSBoard.name / ExternalJob.company —
 * companyName is stored lowercased so lookups are a plain indexed equality.
 */
const BlockedCompany = sequelize.define('BlockedCompany', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Lowercased company name, matched against ATSBoard.name / ExternalJob.company'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  tableName: 'BlockedCompanies',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['companyName'] }
  ]
});

module.exports = BlockedCompany;
