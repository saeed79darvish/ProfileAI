const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Poll = sequelize.define('Poll', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  authorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  question: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [10, 500]
    }
  },
  options: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    // Structure: [{ id: 'opt1', text: 'Option 1', votes: 0 }]
    validate: {
      isValidOptions(value) {
        if (!Array.isArray(value) || value.length < 2 || value.length > 4) {
          throw new Error('Poll must have between 2 and 4 options');
        }
        for (const opt of value) {
          if (!opt.id || !opt.text || typeof opt.votes !== 'number') {
            throw new Error('Each option must have id, text, and votes');
          }
        }
      }
    }
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  isAnonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  category: {
    type: DataTypes.ENUM('career', 'tech', 'industry', 'learning', 'general'),
    defaultValue: 'general'
  },
  totalVotes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isHotTake: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // Additional fields for engagement
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  shares: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Post integration - polls can be standalone or attached to posts
  postId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Posts',
      key: 'id'
    }
  }
}, {
  tableName: 'Polls',
  timestamps: true,
  indexes: [
    { fields: ['authorId'] },
    { fields: ['category'] },
    { fields: ['expiresAt'] },
    { fields: ['isHotTake'] },
    { fields: ['totalVotes'] },
    { fields: ['createdAt'] }
  ]
});

// Check if poll has expired
Poll.prototype.isExpired = function() {
  return new Date() > new Date(this.expiresAt);
};

// Calculate if poll qualifies as a "Hot Take" (polarizing: 40-60% split)
Poll.prototype.calculateHotTake = function() {
  if (this.totalVotes < 10) return false; // Need minimum votes
  
  const percentages = this.options.map(opt => 
    this.totalVotes > 0 ? (opt.votes / this.totalVotes) * 100 : 0
  );
  
  // Check if any two options are within 40-60% split
  for (let i = 0; i < percentages.length; i++) {
    for (let j = i + 1; j < percentages.length; j++) {
      const combined = percentages[i] + percentages[j];
      if (combined >= 80) { // These two are the main contenders
        const smaller = Math.min(percentages[i], percentages[j]);
        const larger = Math.max(percentages[i], percentages[j]);
        // Check if split is between 40-60
        if (smaller >= 35 && smaller <= 50 && larger >= 50 && larger <= 65) {
          return true;
        }
      }
    }
  }
  return false;
};

// Get expiry duration presets
Poll.getExpiryPresets = () => [
  { value: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { value: '6h', label: '6 hours', ms: 6 * 60 * 60 * 1000 },
  { value: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: '3d', label: '3 days', ms: 3 * 24 * 60 * 60 * 1000 },
  { value: '7d', label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 }
];

// Get category info
Poll.getCategoryInfo = (category) => {
  const categories = {
    career: { emoji: '💼', label: 'Career Decisions', color: '#3B82F6' },
    tech: { emoji: '🛠', label: 'Tech Debates', color: '#10B981' },
    industry: { emoji: '📈', label: 'Industry Predictions', color: '#F59E0B' },
    learning: { emoji: '🎓', label: 'Learning Paths', color: '#8B5CF6' },
    general: { emoji: '💭', label: 'General', color: '#6B7280' }
  };
  return categories[category] || categories.general;
};

// Get all categories
Poll.getAllCategories = () => [
  { value: 'career', emoji: '💼', label: 'Career Decisions' },
  { value: 'tech', emoji: '🛠', label: 'Tech Debates' },
  { value: 'industry', emoji: '📈', label: 'Industry Predictions' },
  { value: 'learning', emoji: '🎓', label: 'Learning Paths' },
  { value: 'general', emoji: '💭', label: 'General' }
];

module.exports = Poll;
