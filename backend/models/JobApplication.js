const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const JobApplication = sequelize.define('JobApplication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  jobId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Jobs',
      key: 'id'
    }
  },
  candidateId: {
    type: DataTypes.UUID,
    allowNull: true, // Nullable for guest screening submissions
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  // For guest submissions linked to imported candidates
  importedCandidateId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'ImportedCandidates',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM(
      'pending_screening',
      'submitted',
      'under_review',
      'screening',
      'shortlisted',
      'interview_scheduled',
      'interview_completed',
      'offered',
      'accepted',
      'rejected',
      'withdrawn'
    ),
    defaultValue: 'submitted'
  },
  answers: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Candidate answers to application questions'
  },
  resumeUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  coverLetter: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  aiMatchScore: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'AI-generated match score (0-100)'
  },
  aiAnalysis: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'AI analysis of the application'
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  reviewedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  recruiterNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Where the application came from (e.g., job board, referral, direct, guest_screening)'
  },
  // Guest screening fields
  screeningConsent: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  screeningConsentAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  trackingCode: {
    type: DataTypes.STRING(12),
    allowNull: true
  },
  // AI-parsed resume data for guest submissions
  parsedResumeData: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  // Guest candidate info (when no user account)
  guestEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { isEmail: true }
  },
  guestName: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'JobApplications',
  indexes: [
    {
      fields: ['jobId']
    },
    {
      fields: ['candidateId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['aiMatchScore']
    },
    {
      unique: true,
      fields: ['jobId', 'candidateId'],
      name: 'unique_job_candidate',
      where: { candidateId: { [require('sequelize').Op.ne]: null } }
    },
    {
      fields: ['importedCandidateId']
    },
    {
      fields: ['trackingCode'],
      unique: true,
      where: { trackingCode: { [require('sequelize').Op.ne]: null } }
    },
    {
      fields: ['guestEmail']
    }
  ]
});

module.exports = JobApplication;
