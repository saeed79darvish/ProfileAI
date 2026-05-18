/**
 * CandidateInvitation Model
 * 
 * Tracks invitations sent to imported candidates for a specific job.
 * Handles the consent workflow before AI screening.
 * 
 * Flow:
 * 1. Recruiter imports candidates via CSV
 * 2. Recruiter sends invitations to imported candidates
 * 3. Candidates receive email with unique token
 * 4. Candidates click link, accept T&C, consent to AI screening
 * 5. Upon acceptance, candidate profile is created/linked
 * 6. AI screening begins for accepted candidates
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const crypto = require('crypto');

const CandidateInvitation = sequelize.define('CandidateInvitation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Link to the import batch
  importId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'CandidateImports',
      key: 'id'
    }
  },
  
  // Link to the imported candidate record
  importedCandidateId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'ImportedCandidates',
      key: 'id'
    }
  },
  
  // Link to job (from import)
  jobId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Jobs',
      key: 'id'
    }
  },
  
  // Recruiter who sent the invitation
  recruiterId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  
  // Candidate info (denormalized for easy access)
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  
  // Unique invitation token
  invitationToken: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  
  // Invitation status
  status: {
    type: DataTypes.ENUM(
      'pending',      // Created but not sent
      'sent',         // Email sent
      'delivered',    // Email confirmed delivered
      'opened',       // Candidate opened the email
      'clicked',      // Candidate clicked the link
      'accepted',     // Candidate accepted and consented (full signup)
      'submitted',    // Candidate submitted guest screening (no signup)
      'declined',     // Candidate declined
      'expired',      // Invitation expired
      'bounced',      // Email bounced
      'unsubscribed'  // Candidate unsubscribed
    ),
    defaultValue: 'pending',
    allowNull: false
  },
  
  // How the candidate responded (full_signup or guest_screening)
  submissionType: {
    type: DataTypes.ENUM('full_signup', 'guest_screening'),
    allowNull: true
  },
  
  // Email tracking
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  openedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  clickedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Response tracking
  respondedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Consent data (stored when accepted)
  consentData: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: null
  },
  
  // Expiration
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  
  // If accepted, link to created user/profile
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
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
  
  // Link to job application created
  jobApplicationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'JobApplications',
      key: 'id'
    }
  },
  
  // Custom message from recruiter (optional)
  personalMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Decline reason (if declined)
  declineReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Email send attempts and errors
  sendAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Reminder tracking
  remindersSent: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastReminderAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'CandidateInvitations',
  indexes: [
    { fields: ['importId'] },
    { fields: ['importedCandidateId'] },
    { fields: ['jobId'] },
    { fields: ['recruiterId'] },
    { fields: ['email'] },
    { fields: ['invitationToken'], unique: true },
    { fields: ['status'] },
    { fields: ['expiresAt'] },
    { fields: ['createdAt'] }
  ]
});

// Class method to generate secure token
CandidateInvitation.generateToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

// Instance method to check if expired
CandidateInvitation.prototype.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Instance method to check if can be responded to
CandidateInvitation.prototype.canRespond = function() {
  return ['sent', 'delivered', 'opened', 'clicked'].includes(this.status) && !this.isExpired();
};

// Instance method to check if guest submission is allowed
CandidateInvitation.prototype.canSubmitGuestScreening = function() {
  return ['sent', 'delivered', 'opened', 'clicked'].includes(this.status) && !this.isExpired();
};

module.exports = CandidateInvitation;
