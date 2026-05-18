const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * CreditPack Model
 * 
 * Tracks purchased credit packs for users.
 * Credits never expire and are used as overflow when subscription limits are exhausted.
 * Each row represents remaining credits for a specific feature from a specific purchase.
 */
const CreditPack = sequelize.define('CreditPack', {
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
  // Which pack was purchased (matches keys in CREDIT_PACKS config)
  packType: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  // Feature type this credit row applies to
  // NOTE: career_suggestions & agent_arena are deprecated but kept in ENUM
  // because PostgreSQL cannot remove values from existing ENUM types
  featureType: {
    type: DataTypes.ENUM(
      'resume_parse',
      'profile_enhance',
      'tailor_profile',
      'cover_letter',
      'post_enhance',
      'career_suggestions',
      'agent_arena'
    ),
    allowNull: false
  },
  // How many credits were originally purchased for this feature
  creditsTotal: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  // How many credits remain
  creditsRemaining: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  // Payment info
  amountPaid: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD'
  },
  stripePaymentIntentId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  stripeSessionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Status
  status: {
    type: DataTypes.ENUM('active', 'exhausted', 'refunded'),
    defaultValue: 'active'
  },
  purchasedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  }
}, {
  tableName: 'CreditPacks',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['featureType']
    },
    {
      fields: ['status']
    },
    {
      // For efficient lookup of available credits
      fields: ['userId', 'featureType', 'status']
    }
  ]
});

module.exports = CreditPack;
