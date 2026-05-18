const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * JobScreening Model
 * Tracks the automated candidate screening process for a job posting.
 * Created when a job is posted, updated as screening progresses.
 * 
 * WORKFLOW:
 * 1. pending -> Job created, screening not started
 * 2. searching -> Smart search in progress (finding candidates)
 * 3. screening -> AI agents are interviewing filtered candidates
 * 4. completed -> Process finished, shortlist available
 * 5. failed -> Error occurred
 */
const JobScreening = sequelize.define('JobScreening', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  jobId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'Jobs',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'searching', 'search_complete', 'screening', 'completed', 'failed'),
    defaultValue: 'pending'
  },
  // Smart Search Phase Tracking
  searchCriteria: {
    type: DataTypes.JSON,
    allowNull: true
    // Stores the criteria used: { skills, experienceLevel, location, etc. }
  },
  searchStartedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  searchCompletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  totalCandidatesEvaluated: {
    type: DataTypes.INTEGER,
    defaultValue: 0
    // Total candidates considered during smart search
  },
  candidatesFound: {
    type: DataTypes.INTEGER,
    defaultValue: 0
    // Candidates that passed smart search filter
  },
  searchResults: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
    // Smart Search results: [{ candidateId, name, email, score, breakdown, profilePicture }]
  },
  selectedCandidateIds: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    allowNull: true,
    defaultValue: []
    // IDs of candidates recruiter selected for AI screening
  },
  candidatesScreened: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Store shortlisted candidates with their scores
  shortlisted: {
    type: DataTypes.JSON,
    defaultValue: []
    // Format: [{ candidateId, name, fitScore, interestScore, profilePicture }]
  },
  // Progress tracking
  currentStep: {
    type: DataTypes.STRING,
    allowNull: true
    // e.g., "Finding candidates", "Screening candidate 3/10", "Shortlisting"
  },
  currentPhase: {
    type: DataTypes.STRING,
    allowNull: true
    // 'search' or 'screening' - helps frontend distinguish phases
  },
  progressPercent: {
    type: DataTypes.INTEGER,
    defaultValue: 0
    // Overall progress 0-100
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Store any errors that occurred
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Recruiter Feedback on screening quality
  recruiterFeedback: {
    type: DataTypes.JSON,
    allowNull: true
    // { rating: 1-5, notes: "", submittedAt: Date }
  },
  // AI Screening Configuration
  screeningConfig: {
    type: DataTypes.JSON,
    allowNull: true
    // { minMatchScore, candidatesToScreen, enablePhoneScreening, phoneScreeningDuration, etc. }
  }
}, {
  timestamps: true,
  tableName: 'JobScreenings'
});

module.exports = JobScreening;
