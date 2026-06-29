const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AIUsage = sequelize.define('AIUsage', {
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
  featureType: {
    type: DataTypes.ENUM(
      'resume_parse',
      'profile_enhance',
      'tailor_profile',
      'cover_letter',
      'career_suggestions',
      'agent_arena',
      'post_enhance',
      'analyze_gaps',
      'generate_answers',
      'generate_cover_letter',
      'job_enhance',
      'interview_prep'
    ),
    allowNull: false
  },
  usedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  tokensUsed: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  estimatedCost: {
    type: DataTypes.DECIMAL(10, 6),
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  }
}, {
  tableName: 'AIUsages',
  timestamps: true,
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['featureType']
    },
    {
      fields: ['usedAt']
    },
    {
      // Composite index for efficient daily/monthly queries
      fields: ['userId', 'featureType', 'usedAt']
    }
  ]
});

module.exports = AIUsage;
