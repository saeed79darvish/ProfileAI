const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserReputation = sequelize.define('UserReputation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    // Core stats
    teachingCredits: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    sessionsAttended: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    peopleHelped: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    // Detailed stats
    totalSessionsHosted: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    totalTeachingSessions: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    totalShowcases: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    totalMentorships: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    // Quality metrics
    averageRating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.00
    },
    totalRatingsReceived: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    // Level system
    currentLevel: {
      type: DataTypes.ENUM('newcomer', 'contributor', 'expert', 'master', 'legend'),
      defaultValue: 'newcomer'
    },
    // Progress to next level (0-100)
    levelProgress: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    // Streak tracking
    currentStreak: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    longestStreak: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lastSessionDate: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'UserReputations',
    timestamps: true,
    indexes: [
      { fields: ['userId'], unique: true },
      { fields: ['teachingCredits'] },
      { fields: ['currentLevel'] }
    ]
  });

  // Calculate level based on sessions
  UserReputation.calculateLevel = (totalSessions) => {
    if (totalSessions >= 100) return 'legend';
    if (totalSessions >= 51) return 'master';
    if (totalSessions >= 26) return 'expert';
    if (totalSessions >= 11) return 'contributor';
    return 'newcomer';
  };

  // Calculate progress to next level
  UserReputation.calculateLevelProgress = (totalSessions, currentLevel) => {
    const thresholds = {
      'newcomer': { min: 0, max: 10 },
      'contributor': { min: 11, max: 25 },
      'expert': { min: 26, max: 50 },
      'master': { min: 51, max: 100 },
      'legend': { min: 100, max: 100 }
    };
    
    const { min, max } = thresholds[currentLevel];
    if (currentLevel === 'legend') return 100;
    
    const progress = ((totalSessions - min) / (max - min + 1)) * 100;
    return Math.min(Math.floor(progress), 100);
  };

  return UserReputation;
};
