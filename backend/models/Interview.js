const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Interview = sequelize.define('Interview', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Foreign Keys - All UUID to match other models
  jobId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  candidateId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  recruiterId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  screeningId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  messageId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  // Scheduling
  proposedSlots: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: []
    // Example: [{ datetime: "2025-01-02T10:00:00Z", duration: 30 }, ...]
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  duration: {
    type: DataTypes.INTEGER,
    defaultValue: 30
  },
  timezone: {
    type: DataTypes.STRING,
    defaultValue: 'UTC'
  },

  // Interview Details
  type: {
    type: DataTypes.ENUM('screening', 'technical', 'behavioral', 'final', 'other'),
    defaultValue: 'screening'
  },
  format: {
    type: DataTypes.ENUM('video', 'phone', 'in_person'),
    defaultValue: 'video'
  },
  meetingLink: {
    type: DataTypes.STRING,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Status Flow
  status: {
    type: DataTypes.ENUM(
      'pending',
      'confirmed',
      'rescheduled',
      'reschedule_requested',
      'completed',
      'cancelled',
      'no_show'
    ),
    defaultValue: 'pending'
  },

  // Notes & Feedback
  recruiterNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  feedback: {
    type: DataTypes.JSONB,
    allowNull: true
  },

  // Reminders
  reminderSentAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Tracking
  confirmedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelReason: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Candidate response
  candidateResponse: {
    type: DataTypes.JSONB,
    allowNull: true
    // Example: { selectedSlot: 0, message: "Looking forward to it!" }
  },

  // Reschedule History
  rescheduleHistory: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    comment: 'History of reschedule actions'
  },

  // Phone Screening Settings
  phoneScreeningEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether AI phone screening is enabled for this interview'
  },
  phoneScreeningDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 15,
    comment: 'Duration of phone screening in minutes (15 or 30)'
  },
  phoneScreeningCallId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Reference to PhoneScreeningCall record'
  }
});

module.exports = Interview;
