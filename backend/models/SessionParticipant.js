const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SessionParticipant = sequelize.define('SessionParticipant', {
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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    role: {
      type: DataTypes.ENUM('host', 'co-host', 'mentor', 'attendee'),
      defaultValue: 'attendee'
    },
    status: {
      type: DataTypes.ENUM('registered', 'attended', 'cancelled', 'no-show'),
      defaultValue: 'registered'
    },
    joinedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    leftAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // For mentorship - track if this mentor has been confirmed
    isConfirmed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'SessionParticipants',
    timestamps: true,
    indexes: [
      { fields: ['sessionId'] },
      { fields: ['userId'] },
      { fields: ['status'] },
      { 
        unique: true,
        fields: ['sessionId', 'userId']
      }
    ]
  });

  return SessionParticipant;
};
