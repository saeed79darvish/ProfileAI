const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Conversation = sequelize.define('Conversation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  participant1Id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  participant2Id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  lastMessageAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastMessagePreview: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'Conversations',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['participant1Id', 'participant2Id'],
      name: 'unique_conversation'
    },
    {
      fields: ['participant1Id'],
      name: 'idx_participant1'
    },
    {
      fields: ['participant2Id'],
      name: 'idx_participant2'
    },
    {
      fields: ['lastMessageAt'],
      name: 'idx_last_message'
    }
  ]
});

module.exports = Conversation;
