const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * ApplyPilotCredential — encrypted ATS credential material per candidate.
 *
 * Secrets are always stored encrypted at rest in `secretEncrypted`.
 * Never expose decrypted secrets through HTTP responses.
 */
const ApplyPilotCredential = sequelize.define('ApplyPilotCredential', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE',
  },
  provider: {
    type: DataTypes.ENUM(
      'greenhouse',
      'lever',
      'ashby',
      'workable',
      'smartrecruiters',
      'workday',
      'taleo',
      'icims',
      'custom'
    ),
    allowNull: false,
  },
  authType: {
    type: DataTypes.ENUM('password', 'api_key', 'oauth_token', 'session_cookie'),
    allowNull: false,
    defaultValue: 'password',
  },
  label: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  accountIdentifier: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Username/email/login identifier for this ATS credential',
  },
  secretEncrypted: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  lastVerifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'ApplyPilotCredentials',
  indexes: [
    { fields: ['userId'], name: 'idx_applypilot_cred_user' },
    { fields: ['provider'], name: 'idx_applypilot_cred_provider' },
    { fields: ['userId', 'provider', 'isActive'], name: 'idx_applypilot_cred_user_provider_active' },
  ],
});

module.exports = ApplyPilotCredential;
