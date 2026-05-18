const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
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
  type: {
    type: DataTypes.ENUM(
      'interview_scheduled',
      'interview_updated',
      'interview_cancelled',
      'interview_reminder',
      'application_received',
      'application_status',
      'message_received',
      'agent_update',
      'agent_completed',
      'follow_new',
      'post_like',
      'post_comment',
      'kudos',
      'system'
    ),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    comment: 'Related entity IDs: { jobId, interviewId, applicationId, conversationId, negotiationId, postId, userId }'
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'Notifications',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['type']
    },
    {
      fields: ['isRead']
    },
    {
      fields: ['createdAt']
    },
    {
      // Composite index for efficient unread queries
      fields: ['userId', 'isRead']
    }
  ]
});

module.exports = Notification;
