const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NegotiationMessage = sequelize.define('NegotiationMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  negotiationId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'AgentNegotiations',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  // Which agent sent this message
  agentRole: {
    type: DataTypes.ENUM('candidate_agent', 'recruiter_agent', 'system'),
    allowNull: false
  },
  // The visible message content
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  // AI's internal reasoning (shown to user for transparency)
  internalReasoning: {
    type: DataTypes.TEXT,
    allowNull: true
    // Example: "The candidate has strong React skills which match 80% of requirements.
    // However, salary expectations ($150k) exceed budget ($130k). Will probe flexibility."
  },
  // Type of message for UI rendering and flow control
  messageType: {
    type: DataTypes.ENUM(
      'opening_pitch',     // Initial message when starting negotiation
      'question',          // Asking for clarification
      'answer',            // Responding to a question
      'highlight',         // Highlighting strengths/benefits
      'concern',           // Raising a concern
      'counter_offer',     // Proposing alternative terms
      'acceptance',        // Agreeing to proceed
      'rejection',         // Declining to proceed
      'summary',           // Round summary
      'system'             // System message (status changes, etc.)
    ),
    defaultValue: 'highlight'
  },
  // Structured proposal/offer if any
  proposedTerms: {
    type: DataTypes.JSONB,
    allowNull: true,
    // Structure: {
    //   salary: number,
    //   remote: boolean,
    //   hybridDays: number,
    //   startDate: string,
    //   benefits: string[],
    //   title: string,
    //   otherTerms: object
    // }
  },
  // Sentiment analysis of the message
  sentiment: {
    type: DataTypes.ENUM('positive', 'neutral', 'negative', 'cautious'),
    defaultValue: 'neutral'
  },
  // Confidence score in this response (0-100)
  confidenceScore: {
    type: DataTypes.INTEGER,
    defaultValue: 80,
    validate: {
      min: 0,
      max: 100
    }
  },
  // Round number in the conversation
  roundNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  // Token usage tracking for cost management
  tokensUsed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Processing metadata
  processingTimeMs: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'NegotiationMessages',
  indexes: [
    { fields: ['negotiationId'], name: 'idx_negotiation_message_negotiation' },
    { fields: ['agentRole'], name: 'idx_negotiation_message_role' },
    { fields: ['roundNumber'], name: 'idx_negotiation_message_round' },
    { fields: ['messageType'], name: 'idx_negotiation_message_type' },
    { fields: ['negotiationId', 'roundNumber'], name: 'idx_negotiation_message_round_order' }
  ]
});

module.exports = NegotiationMessage;
