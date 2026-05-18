const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CommentLike = sequelize.define('CommentLike', {
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
  commentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Comments',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'commentId']
    }
  ]
});

module.exports = CommentLike;
