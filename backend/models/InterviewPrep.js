const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Shared research cache for "Interview prep": one row per (company, role),
 * reused by every user for 21 days. Holds only public, sourced research.
 * Never put per-user data in this table.
 */
const InterviewPrep = sequelize.define('InterviewPrep', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  companyKey: { type: DataTypes.STRING, allowNull: false },
  roleKey: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' }, // pending | ready | failed
  payload: { type: DataTypes.JSONB, allowNull: true },
  error: { type: DataTypes.TEXT, allowNull: true },
  generatedAt: { type: DataTypes.DATE, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'InterviewPreps',
  timestamps: true,
  indexes: [{ unique: true, fields: ['companyKey', 'roleKey'], name: 'interview_preps_company_role_unique' }],
});

module.exports = InterviewPrep;
