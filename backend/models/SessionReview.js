const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SessionReview = sequelize.define('SessionReview', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    sessionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'CollaborationSessions',
        key: 'id'
      }
    },
    reviewerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    revieweeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      }
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // What the reviewer learned
    learnings: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Would recommend this session
    wouldRecommend: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'SessionReviews',
    timestamps: true,
    indexes: [
      { fields: ['sessionId'] },
      { fields: ['reviewerId'] },
      { fields: ['revieweeId'] },
      { 
        unique: true,
        fields: ['sessionId', 'reviewerId', 'revieweeId']
      }
    ]
  });

  return SessionReview;
};
