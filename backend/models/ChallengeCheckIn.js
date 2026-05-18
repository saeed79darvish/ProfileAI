const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChallengeCheckIn = sequelize.define('ChallengeCheckIn', {
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
  // Which day of the challenge (1-indexed)
  day: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  // Check-in content
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 2000]
    }
  },
  // Mood tracking
  mood: {
    type: DataTypes.ENUM('struggling', 'okay', 'good', 'great', 'crushing'),
    defaultValue: 'okay'
  },
  // Optional image/screenshot
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Additional metadata
  isSkipDay: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // Points earned for this check-in
  pointsEarned: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Milestone completion (if this check-in completes a milestone)
  milestoneCompleted: {
    type: DataTypes.INTEGER,
    allowNull: true // Milestone day number if completed
  },
  // Engagement metrics
  likes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  comments: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Check-in time (for analytics)
  checkInTime: {
    type: DataTypes.TIME,
    allowNull: true
  }
}, {
  tableName: 'ChallengeCheckIns',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['challengeId', 'userId', 'day']
    },
    {
      fields: ['challengeId', 'day']
    },
    {
      fields: ['userId', 'createdAt']
    }
  ]
});

// Mood emoji mapping
ChallengeCheckIn.MOOD_EMOJIS = {
  struggling: '😤',
  okay: '😐',
  good: '🙂',
  great: '😊',
  crushing: '🚀'
};

ChallengeCheckIn.MOOD_LABELS = {
  struggling: 'Struggling',
  okay: 'Okay',
  good: 'Good',
  great: 'Great',
  crushing: 'Crushing it!'
};

// Get mood display
ChallengeCheckIn.prototype.getMoodDisplay = function() {
  return {
    emoji: ChallengeCheckIn.MOOD_EMOJIS[this.mood],
    label: ChallengeCheckIn.MOOD_LABELS[this.mood]
  };
};

module.exports = ChallengeCheckIn;
