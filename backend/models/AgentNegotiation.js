const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AgentNegotiation = sequelize.define('AgentNegotiation', {
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
    },
    onDelete: 'CASCADE'
  },
  candidateId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  recruiterId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  // Who started the negotiation
  initiatorType: {
    type: DataTypes.ENUM('candidate', 'recruiter'),
    allowNull: false
  },
  // Type of conversation
  type: {
    type: DataTypes.ENUM('negotiation', 'screening', 'reschedule'),
    defaultValue: 'negotiation',
    allowNull: false
  },
  // Reference to interview for reschedule negotiations
  interviewId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Interviews',
      key: 'id'
    },
    onDelete: 'SET NULL'
  },
  // Score for screening (0-100)
  screeningScore: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  // Conversation status
  status: {
    type: DataTypes.ENUM(
      'pending',           // Waiting to start
      'negotiating',       // Agents are talking
      'candidate_interested',  // Candidate agent shows interest
      'recruiter_shortlisted', // Recruiter agent shortlisted
      'mutual_match',      // Both agents agree - success!
      'candidate_declined', // Candidate agent rejected
      'recruiter_rejected', // Recruiter agent rejected
      'expired',           // Timed out
      'human_takeover'     // Human stepped in
    ),
    defaultValue: 'pending'
  },
  // Candidate's agent configuration - what the agent knows/prioritizes
  candidateAgentContext: {
    type: DataTypes.JSONB,
    defaultValue: {},
    // Structure: {
    //   minSalary: number,
    //   preferredLocation: string,
    //   mustBeRemote: boolean,
    //   dealBreakers: string[],
    //   priorities: string[], // e.g., ["growth", "work-life-balance", "compensation"]
    //   negotiationStyle: 'aggressive' | 'balanced' | 'collaborative',
    //   additionalContext: string
    // }
  },
  // Recruiter's agent configuration
  recruiterAgentContext: {
    type: DataTypes.JSONB,
    defaultValue: {},
    // Structure: {
    //   maxBudget: number,
    //   urgency: 'low' | 'medium' | 'high',
    //   mustHaveSkills: string[],
    //   niceToHaveSkills: string[],
    //   cultureFit: string[],
    //   flexibleOnRemote: boolean,
    //   negotiationStyle: 'aggressive' | 'balanced' | 'collaborative',
    //   additionalContext: string
    // }
  },
  // Scores determined by agents during conversation
  fitScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
    // Recruiter agent's assessment of candidate fit
  },
  interestScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
    // Candidate agent's interest level in the job
  },
  // Final outcome summary
  outcome: {
    type: DataTypes.JSONB,
    allowNull: true,
    // Structure: {
    //   summary: string,
    //   candidateVerdict: 'interested' | 'not_interested' | 'needs_info',
    //   recruiterVerdict: 'shortlist' | 'reject' | 'maybe',
    //   agreedTerms: { salary: number, remote: boolean, startDate: string },
    //   keyInsights: string[],
    //   recommendedNextSteps: string[]
    // }
  },
  // Conversation metadata
  roundCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  maxRounds: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  lastAgentTurn: {
    type: DataTypes.ENUM('candidate_agent', 'recruiter_agent', 'none'),
    defaultValue: 'none'
  },
  // Timestamps for tracking
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Human intervention tracking
  humanIntervenedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  humanIntervenedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  tableName: 'AgentNegotiations',
  indexes: [
    { fields: ['jobId'], name: 'idx_agent_negotiation_job' },
    { fields: ['candidateId'], name: 'idx_agent_negotiation_candidate' },
    { fields: ['recruiterId'], name: 'idx_agent_negotiation_recruiter' },
    { fields: ['status'], name: 'idx_agent_negotiation_status' },
    { fields: ['initiatorType'], name: 'idx_agent_negotiation_initiator' }
    // Removed unique constraint for development - allows multiple negotiations per job/candidate pair
  ]
});

module.exports = AgentNegotiation;
