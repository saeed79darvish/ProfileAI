const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserBadge = sequelize.define('UserBadge', {
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
      }
    },
    badgeType: {
      type: DataTypes.ENUM(
        'first_steps',      // Host your first session
        'helpful_hand',     // Help 10 people
        'educator',         // Host 10 teaching sessions
        'team_player',      // Participate in 5 team showcases
        'mentor_master',    // Complete 25 mentorship sessions
        'consistency',      // Host sessions 4 weeks in a row
        'rising_star',      // Get 50 total attendees
        'thought_leader',   // Reach 100 teaching credits
        'top_rated',        // Maintain 4.5+ average rating (10+ reviews)
        'early_adopter',    // One of first 100 users
        'streak_keeper',    // 7-day activity streak
        'knowledge_sharer', // Share 5 achievements
        'community_builder' // Help 50 people
      ),
      allowNull: false
    },
    earnedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    // Progress tracking for badges not yet earned
    progress: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    target: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    }
  }, {
    tableName: 'UserBadges',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['badgeType'] },
      { 
        unique: true,
        fields: ['userId', 'badgeType']
      }
    ]
  });

  // Badge definitions with metadata
  UserBadge.BADGE_DEFINITIONS = {
    first_steps: {
      name: 'First Steps',
      description: 'Host your first session',
      icon: '🎯',
      target: 1,
      category: 'hosting'
    },
    helpful_hand: {
      name: 'Helpful Hand',
      description: 'Help 10 people',
      icon: '🤝',
      target: 10,
      category: 'helping'
    },
    educator: {
      name: 'Educator',
      description: 'Host 10 teaching sessions',
      icon: '📚',
      target: 10,
      category: 'teaching'
    },
    team_player: {
      name: 'Team Player',
      description: 'Participate in 5 team showcases',
      icon: '👥',
      target: 5,
      category: 'collaboration'
    },
    mentor_master: {
      name: 'Mentor Master',
      description: 'Complete 25 mentorship sessions',
      icon: '🎓',
      target: 25,
      category: 'mentoring'
    },
    consistency: {
      name: 'Consistency',
      description: 'Host sessions 4 weeks in a row',
      icon: '📅',
      target: 4,
      category: 'streak'
    },
    rising_star: {
      name: 'Rising Star',
      description: 'Get 50 total attendees',
      icon: '⭐',
      target: 50,
      category: 'popularity'
    },
    thought_leader: {
      name: 'Thought Leader',
      description: 'Reach 100 teaching credits',
      icon: '💡',
      target: 100,
      category: 'influence'
    },
    top_rated: {
      name: 'Top Rated',
      description: 'Maintain 4.5+ average rating with 10+ reviews',
      icon: '🏆',
      target: 10,
      category: 'quality'
    },
    early_adopter: {
      name: 'Early Adopter',
      description: 'One of the first 100 users',
      icon: '🚀',
      target: 1,
      category: 'special'
    },
    streak_keeper: {
      name: 'Streak Keeper',
      description: '7-day activity streak',
      icon: '🔥',
      target: 7,
      category: 'streak'
    },
    knowledge_sharer: {
      name: 'Knowledge Sharer',
      description: 'Share 5 achievements',
      icon: '💎',
      target: 5,
      category: 'sharing'
    },
    community_builder: {
      name: 'Community Builder',
      description: 'Help 50 people',
      icon: '🌟',
      target: 50,
      category: 'helping'
    }
  };

  return UserBadge;
};
