const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChallengeParticipant = sequelize.define('ChallengeParticipant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  challengeId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Challenges',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('invited', 'joined', 'active', 'completed', 'dropped'),
    defaultValue: 'joined'
  },
  // Streak tracking
  streak: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  longestStreak: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Points for leaderboard
  points: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Check-in tracking
  lastCheckIn: {
    type: DataTypes.DATE,
    allowNull: true
  },
  totalCheckIns: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Skip days used
  skipDaysUsed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Milestone completion tracking
  completedMilestones: {
    type: DataTypes.JSONB,
    defaultValue: []
    // Structure: [{ day: 1, completedAt: timestamp }, ...]
  },
  // For invited participants
  invitedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  invitedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  joinedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Team assignment (for team challenges)
  teamId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  // Position/rank at completion
  finalRank: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // Completion details
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completionPercentage: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  // Nudge tracking
  lastNudgeSent: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastNudgeReceived: {
    type: DataTypes.DATE,
    allowNull: true
  },
  nudgesReceived: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'ChallengeParticipants',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['challengeId', 'userId']
    },
    {
      fields: ['challengeId', 'points']
    },
    {
      fields: ['userId', 'status']
    }
  ]
});

// Instance methods
ChallengeParticipant.prototype.updateStreak = function(hasCheckedInToday) {
  if (hasCheckedInToday) {
    this.streak += 1;
    if (this.streak > this.longestStreak) {
      this.longestStreak = this.streak;
    }
  } else {
    this.streak = 0;
  }
};

ChallengeParticipant.prototype.addPoints = function(amount, reason) {
  this.points += amount;
  return this.points;
};

ChallengeParticipant.prototype.canBeNudged = function() {
  if (!this.lastNudgeReceived) return true;
  
  // Can only be nudged once every 4 hours
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  return this.lastNudgeReceived < fourHoursAgo;
};

ChallengeParticipant.prototype.recordNudge = function() {
  this.lastNudgeReceived = new Date();
  this.nudgesReceived += 1;
};

// Points system
ChallengeParticipant.POINTS = {
  DAILY_CHECK_IN: 10,
  STREAK_BONUS_3: 5,
  STREAK_BONUS_7: 15,
  STREAK_BONUS_14: 30,
  STREAK_BONUS_30: 100,
  MILESTONE_COMPLETE: 25,
  FIRST_CHECK_IN: 20,
  PHOTO_BONUS: 5,
  GREAT_MOOD: 3,
  CRUSHING_IT: 5
};

module.exports = ChallengeParticipant;
