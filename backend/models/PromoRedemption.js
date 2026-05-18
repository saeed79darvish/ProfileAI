const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PromoRedemption = sequelize.define('PromoRedemption', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  promoCodeId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'PromoCodes', key: 'id' }
  },
  // Snapshot of what was granted
  type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dailyMultiplier: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  dailyBonusFlat: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  grantTier: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // When this benefit expires
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'PromoRedemptions',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['promoCodeId'] },
    { fields: ['expiresAt'] },
    { fields: ['userId', 'promoCodeId'], unique: true } // One redemption per user per code
  ]
});

module.exports = PromoRedemption;
