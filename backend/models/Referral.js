const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const crypto = require('crypto');

const Referral = sequelize.define('Referral', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  referrerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  referredUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  code: {
    type: DataTypes.STRING(12),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'expired', 'rewarded'),
    defaultValue: 'pending'
  },
  rewardType: {
    type: DataTypes.ENUM('premium_days', 'credits', 'badge'),
    defaultValue: 'premium_days'
  },
  rewardAmount: {
    type: DataTypes.INTEGER,
    defaultValue: 30
  },
  rewardedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  clickCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  source: {
    type: DataTypes.ENUM('direct', 'email', 'twitter', 'linkedin', 'whatsapp', 'other'),
    defaultValue: 'direct'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  timestamps: true,
  hooks: {
    beforeCreate: async (referral) => {
      // Generate unique referral code if not provided
      if (!referral.code) {
        referral.code = crypto.randomBytes(6).toString('hex').toUpperCase().substring(0, 8);
      }
    }
  }
});

// Static method to generate a unique code
Referral.generateCode = () => {
  return crypto.randomBytes(6).toString('hex').toUpperCase().substring(0, 8);
};

module.exports = Referral;
