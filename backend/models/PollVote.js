const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PollVote = sequelize.define('PollVote', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  pollId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Polls',
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
  optionId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // For anonymous polls, we still track the vote happened but can hide the user
  isAnonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'PollVotes',
  timestamps: true,
  indexes: [
    { fields: ['pollId'] },
    { fields: ['userId'] },
    { fields: ['optionId'] },
    {
      // One vote per user per poll
      unique: true,
      fields: ['pollId', 'userId'],
      name: 'unique_vote_per_poll'
    }
  ]
});

module.exports = PollVote;
