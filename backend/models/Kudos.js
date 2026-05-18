const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Kudos = sequelize.define('Kudos', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  receiverId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('great_work', 'helpful', 'inspiring', 'expert', 'game_changer'),
    allowNull: false,
    defaultValue: 'great_work'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  postId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Posts',
      key: 'id'
    }
  },
  profileId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Profiles',
      key: 'id'
    }
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'Kudos',
  timestamps: true,
  indexes: [
    {
      fields: ['senderId']
    },
    {
      fields: ['receiverId']
    },
    {
      fields: ['postId']
    },
    {
      fields: ['createdAt']
    },
    {
      // Prevent duplicate kudos on same post from same user
      unique: true,
      fields: ['senderId', 'postId'],
      where: {
        postId: { [require('sequelize').Op.ne]: null }
      },
      name: 'unique_kudos_per_post'
    }
  ]
});

// Static method to get kudos type info
Kudos.getTypeInfo = (type) => {
  const types = {
    great_work: { emoji: '🙌', label: 'Great Work', color: '#FFD700' },
    helpful: { emoji: '💡', label: 'Helpful', color: '#4CAF50' },
    inspiring: { emoji: '🔥', label: 'Inspiring', color: '#FF5722' },
    expert: { emoji: '🎯', label: 'Expert', color: '#2196F3' },
    game_changer: { emoji: '🚀', label: 'Game Changer', color: '#9C27B0' }
  };
  return types[type] || types.great_work;
};

// Static method to get all types
Kudos.getAllTypes = () => {
  return [
    { value: 'great_work', emoji: '🙌', label: 'Great Work', color: '#FFD700' },
    { value: 'helpful', emoji: '💡', label: 'Helpful', color: '#4CAF50' },
    { value: 'inspiring', emoji: '🔥', label: 'Inspiring', color: '#FF5722' },
    { value: 'expert', emoji: '🎯', label: 'Expert', color: '#2196F3' },
    { value: 'game_changer', emoji: '🚀', label: 'Game Changer', color: '#9C27B0' }
  ];
};

module.exports = Kudos;
