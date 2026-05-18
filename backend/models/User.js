const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

// Cost factor for password hashing. 12 is the modern baseline (~250ms/hash
// on commodity hardware) and is reused for the dummy compare in login to
// keep timing constant. Bumping this rotates new hashes only; existing
// hashes keep verifying correctly via the stored salt.
const BCRYPT_ROUNDS = 12;

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true // Allow null for OAuth users
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  /**
   * URL-safe public handle — used to build pretty profile URLs like
   * /profile/saeed-darvish instead of /profile/<uuid>.
   *
   * Generated from firstName + lastName at create time
   * (see utils/slug.js → buildUniqueUserSlug). Unique across users.
   * Allowed null at first to make the alter:true migration painless;
   * the backfill script (scripts/backfillUserSlugs.js) populates legacy rows.
   */
  slug: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  googleId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  githubId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  profilePictureUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'OAuth provider profile picture'
  },
  role: {
    type: DataTypes.ENUM('candidate', 'recruiter', 'admin'),
    defaultValue: 'candidate',
    allowNull: false
  },
  subscriptionTier: {
    type: DataTypes.ENUM('free', 'pro', 'pro_plus', 'enterprise'),
    defaultValue: 'free',
    allowNull: false
  },
  subscriptionStatus: {
    type: DataTypes.ENUM('active', 'cancelled', 'expired', 'trial'),
    defaultValue: 'active'
  },
  subscriptionExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  stripeCustomerId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  stripeSubscriptionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = User;
