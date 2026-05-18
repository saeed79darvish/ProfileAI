const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CollaborationSession = sequelize.define('CollaborationSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    hostId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    sessionType: {
      type: DataTypes.ENUM('teaching', 'showcase', 'mentorship'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('draft', 'scheduled', 'live', 'completed', 'cancelled'),
      defaultValue: 'scheduled'
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [5, 255]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    tags: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    // What help is needed (for mentorship type)
    helpTopics: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    durationMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      validate: {
        min: 15,
        max: 180
      }
    },
    maxParticipants: {
      type: DataTypes.INTEGER,
      defaultValue: 20,
      validate: {
        min: 1,
        max: 100
      }
    },
    currentParticipants: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    scheduledTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    meetingLink: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    recordingUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    // AI-generated content
    aiSummary: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    aiMatchScore: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    // Stats
    totalAttendees: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    averageRating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.00
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    // For team showcases - project details
    projectDuration: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    // Is this a featured/promoted session
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'CollaborationSessions',
    timestamps: true,
    indexes: [
      { fields: ['hostId'] },
      { fields: ['sessionType'] },
      { fields: ['status'] },
      { fields: ['scheduledTime'] },
      { fields: ['category'] },
      { fields: ['createdAt'] }
    ]
  });

  return CollaborationSession;
};
