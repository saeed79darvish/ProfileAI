const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PromoCode = sequelize.define('PromoCode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // What the promo grants
  type: {
    type: DataTypes.ENUM('ai_bonus', 'subscription_upgrade', 'trial_extension'),
    allowNull: false,
    defaultValue: 'ai_bonus'
  },
  // For ai_bonus type: multiplier applied to daily limits (e.g. 2 = double, 3 = triple)
  dailyMultiplier: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 2
  },
  // For ai_bonus type: flat bonus added to daily limits (applied AFTER multiplier if both set)
  dailyBonusFlat: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  // For subscription_upgrade type
  grantTier: {
    type: DataTypes.ENUM('free', 'pro', 'enterprise'),
    allowNull: true
  },
  // Duration in days that the promo benefit lasts after redemption
  durationDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30
  },
  // Usage limits
  maxRedemptions: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  currentRedemptions: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Validity window
  validFrom: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  validUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'PromoCodes',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['code'] },
    { fields: ['isActive'] },
    { fields: ['validUntil'] }
  ]
});

module.exports = PromoCode;
