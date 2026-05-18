const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Challenge = sequelize.define('Challenge', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  creatorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      len: [5, 200]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 365
    }
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true // Set when challenge becomes active
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true // Calculated from startDate + duration
  },
  type: {
    type: DataTypes.ENUM('sprint', 'deep_dive', 'transformation', 'custom'),
    defaultValue: 'custom'
  },
  visibility: {
    type: DataTypes.ENUM('public', 'friends', 'private'),
    defaultValue: 'public'
  },
  minParticipants: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1
    }
  },
  maxParticipants: {
    type: DataTypes.INTEGER,
    defaultValue: 50,
    validate: {
      min: 1,
      max: 1000
    }
  },
  milestones: {
    type: DataTypes.JSONB,
    defaultValue: [],
    // Structure: [{ day: 1, title: 'Day 1', description: 'First step' }, ...]
  },
  status: {
    type: DataTypes.ENUM('draft', 'recruiting', 'active', 'completed', 'cancelled'),
    defaultValue: 'draft'
  },
  inviteCode: {
    type: DataTypes.STRING(12),
    unique: true,
    allowNull: true
  },
  // Challenge rules
  allowSkipDays: {
    type: DataTypes.INTEGER,
    defaultValue: 2, // Max skip days allowed
    validate: {
      min: 0,
      max: 10
    }
  },
  requireDailyCheckIn: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  // Team challenge settings
  isTeamChallenge: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  teamSize: {
    type: DataTypes.INTEGER,
    defaultValue: null // e.g., 2 for 2v2, 3 for 3v3
  },
  // Bet/stakes (optional fun feature)
  stakes: {
    type: DataTypes.STRING(200),
    allowNull: true // e.g., "Loser buys coffee"
  },
  // Cover image for the challenge
  coverImage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Tags for discovery
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  // Stats (cached for performance)
  participantCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  completionRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  }
}, {
  tableName: 'Challenges',
  timestamps: true,
  hooks: {
    beforeCreate: (challenge) => {
      // Generate unique invite code
      if (!challenge.inviteCode) {
        challenge.inviteCode = generateInviteCode();
      }
    }
  }
});

// Generate a unique 8-character invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Instance methods
Challenge.prototype.canJoin = function(userId) {
  if (this.status !== 'recruiting') return false;
  if (this.participantCount >= this.maxParticipants) return false;
  return true;
};

Challenge.prototype.canStart = function() {
  return this.status === 'recruiting' && 
         this.participantCount >= this.minParticipants;
};

Challenge.prototype.calculateEndDate = function() {
  if (this.startDate && this.duration) {
    const end = new Date(this.startDate);
    end.setDate(end.getDate() + this.duration);
    return end;
  }
  return null;
};

// Class methods
Challenge.findByInviteCode = async function(code) {
  return this.findOne({ where: { inviteCode: code.toUpperCase() } });
};

Challenge.getActivePublicChallenges = async function(limit = 10) {
  return this.findAll({
    where: {
      status: 'recruiting',
      visibility: 'public'
    },
    order: [['createdAt', 'DESC']],
    limit
  });
};

module.exports = Challenge;
