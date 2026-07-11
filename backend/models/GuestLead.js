const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Email leads captured from the guest LinkedIn Profile Analyzer teaser.
 * Written when a signed-out user submits their email to receive the full
 * report; `convertedToUser` is flipped when the same email later signs up
 * (see the /api/auth signup handler).
 *
 * Dedupe policy: at most one row per (email, DATE(createdAt)) — a user
 * shouldn't receive the same emailed report twice on the same day.
 */
const GuestLead = sequelize.define('GuestLead', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING(320),
    allowNull: false,
  },
  emailNormalized: {
    // Lowercased for deduping / lookup. We keep the original in `email`
    // for the outbound envelope so the user sees exactly what they typed.
    type: DataTypes.STRING(320),
    allowNull: false,
  },
  profileUrlKey: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  analysisCacheId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  ipHash: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  unsubscribeToken: {
    // Opaque token embedded in the report email's unsubscribe link. Stateless
    // (signed JWT), stored here so we can also fast-lookup and revoke without
    // trusting the token alone.
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  emailedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  emailDeliveryOk: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  unsubscribed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  convertedToUser: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  convertedUserId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  convertedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'GuestLeads',
  timestamps: true,
  indexes: [
    { fields: ['emailNormalized'] },
    { fields: ['profileUrlKey'] },
    { fields: ['analysisCacheId'] },
    { fields: ['convertedToUser'] },
  ],
});

module.exports = GuestLead;
