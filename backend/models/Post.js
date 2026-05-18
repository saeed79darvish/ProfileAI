const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Post = sequelize.define('Post', {
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
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [1, 5000]
    }
  },
  postType: {
    type: DataTypes.ENUM('update', 'project', 'achievement', 'job_opportunity', 'announcement'),
    defaultValue: 'update'
  },
  authorType: {
    type: DataTypes.ENUM('candidate', 'recruiter'),
    allowNull: false
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  linkUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  linkTitle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  likes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  commentsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  // Placeholder for AI-driven features
  aiSuggested: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  aiEnhanced: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  aiMetadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Stores AI analysis data: sentiment, topics, engagement prediction, etc.'
  },
  idempotencyKey: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'Client-supplied UUID to deduplicate POST /posts retries.'
  }
}, {
  tableName: 'Posts',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['authorType']
    },
    {
      fields: ['postType']
    },
    {
      fields: ['createdAt']
    },
    {
      // Per-user uniqueness on the idempotency key.
      name: 'posts_user_idempotency_unique',
      unique: true,
      fields: ['userId', 'idempotencyKey']
    }
  ]
});

module.exports = Post;
