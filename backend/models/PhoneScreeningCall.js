const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PhoneScreeningCall = sequelize.define('PhoneScreeningCall', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Foreign keys
  interviewId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Interviews', key: 'id' }
  },
  jobId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Jobs', key: 'id' }
  },
  candidateId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  recruiterId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  
  // Vapi identifiers
  vapiCallId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  vapiAssistantId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  // Call details
  candidatePhone: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'E.164 format phone number'
  },
  candidateName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  jobTitle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  // Call status
  status: {
    type: DataTypes.ENUM(
      'scheduled',      // Waiting for scheduled time
      'pending',        // Ready to call
      'initiating',     // Call being initiated (concurrency guard)
      'queued',         // Vapi is dialing
      'ringing',        // Phone is ringing
      'in_progress',    // Call connected, screening in progress
      'completed',      // Call ended successfully
      'failed',         // Call failed (technical error)
      'no_answer',      // Candidate didn't answer
      'voicemail',      // Went to voicemail
      'busy',           // Line was busy
      'cancelled'       // Cancelled before call
    ),
    defaultValue: 'scheduled'
  },
  
  // Timing
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  callAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  maxAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 1 // Only call once - candidate must reschedule if they miss it
  },
  retryAfterMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  nextRetryAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  durationSeconds: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  targetDurationMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 15,
    comment: '15 or 30 minutes screening'
  },
  
  // Transcript and recording
  transcript: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  transcriptMessages: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Structured conversation messages array'
  },
  recordingUrl: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  recordingStereoUrl: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  
  // AI Analysis Results
  summary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'AI-generated call summary'
  },
  screeningScore: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: '0-100 overall score'
  },
  screeningResult: {
    type: DataTypes.ENUM('passed', 'failed', 'needs_review', 'inconclusive'),
    allowNull: true
  },
  recommendation: {
    type: DataTypes.ENUM('strong_hire', 'hire', 'maybe', 'no_hire', 'strong_no_hire'),
    allowNull: true
  },
  
  // Detailed scoring breakdown
  scoreBreakdown: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Detailed scores: communication, experience, skills, enthusiasm, culture_fit'
  },
  
  // Extracted information from call
  extractedData: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Structured data: years_experience, salary_expectations, availability, etc.'
  },
  
  // Key insights
  strengths: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of identified strengths'
  },
  concerns: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of concerns or red flags'
  },
  keyQuotes: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Notable quotes from candidate'
  },
  
  // Questions asked and responses
  screeningQuestions: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'List of questions prepared for screening'
  },
  questionsAsked: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Questions actually asked during call'
  },
  
  // Live monitoring (Human-in-the-loop)
  listenUrl: {
    type: DataTypes.STRING(1000),
    allowNull: true,
    comment: 'WebSocket URL for live listening'
  },
  controlUrl: {
    type: DataTypes.STRING(1000),
    allowNull: true,
    comment: 'WebSocket URL for live control/takeover'
  },
  monitoredBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Recruiter who listened in'
  },
  monitoredAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  humanTookOver: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  // Candidate consent
  consentRecorded: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether candidate gave verbal consent to recording'
  },
  consentTimestamp: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Cost tracking
  cost: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: true
  },
  
  // Error handling
  endedReason: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Vapi ended reason: hangup, voicemail, silence, etc.'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Notification status
  resultsEmailSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  resultsEmailSentAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Raw Vapi response for debugging
  vapiRawResponse: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  tableName: 'PhoneScreeningCalls',
  timestamps: true,
  indexes: [
    { fields: ['vapiCallId'], unique: true },
    { fields: ['interviewId'] },
    { fields: ['jobId'] },
    { fields: ['candidateId'] },
    { fields: ['recruiterId'] },
    { fields: ['status'] },
    { fields: ['scheduledAt'] },
    { fields: ['screeningResult'] }
  ]
});

module.exports = PhoneScreeningCall;
