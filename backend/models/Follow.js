const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Follow = sequelize.define('Follow', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  followerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'The user who is following'
  },
  followingId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'The user being followed'
  }
}, {
  tableName: 'Follows',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['followerId', 'followingId'],
      name: 'unique_follow'
    },
    {
      fields: ['followerId'],
      name: 'idx_follower'
    },
    {
      fields: ['followingId'],
      name: 'idx_following'
    }
  ]
});

module.exports = Follow;
