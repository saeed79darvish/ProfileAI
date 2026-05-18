/**
 * CandidateInsights Model
 * 
 * Caches aggregated candidate intelligence for AI agent negotiations.
 * This reduces repeated AI calls and ensures consistent information
 * across multiple negotiations for the same candidate.
 * 
 * TTL: 24 hours by default, refreshed when profile/posts change.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CandidateInsights = sequelize.define('CandidateInsights', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'The candidate user this insights cache belongs to'
  },

  // ========================================
  // Aggregated Data Cache
  // ========================================
  
  aggregatedData: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Full aggregated candidate data from CandidateDataAggregator'
  },

  // ========================================
  // AI-Generated Insights
  // ========================================

  strengthsAnalysis: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Proven strengths with evidence from analyzeCandidateStrengthsWithEvidence()'
  },

  generalFitProfile: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'General fit profile applicable across jobs'
  },

  careerNarrative: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'AI-generated career story summarizing trajectory and achievements'
  },

  // ========================================
  // Quick Reference Fields
  // ========================================

  topSkills: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    comment: 'Top 10 skills with proficiency levels'
  },

  topStrengths: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    comment: 'Top 5 proven strengths with evidence'
  },

  experienceYears: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Total years of experience calculated'
  },

  projectsCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Number of portfolio projects'
  },

  postsCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Number of public posts/articles'
  },

  profileCompleteness: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Profile completeness percentage'
  },

  // ========================================
  // Job-Specific Cache
  // ========================================

  recentJobAssessments: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    comment: 'Cache of recent job-specific fit assessments (max 10)'
  },

  // ========================================
  // Data Source Tracking
  // ========================================

  dataSourcesHash: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'Hash of source data to detect changes (profile + posts hash)'
  },

  lastProfileUpdate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the candidate profile was last modified'
  },

  lastPostsUpdate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When candidate posts were last modified'
  },

  // ========================================
  // Cache Management
  // ========================================

  generatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'When this insights cache was generated'
  },

  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'When this cache expires (default 24 hours)'
  },

  regenerationCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Number of times insights have been regenerated'
  },

  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When insights were last used in a negotiation'
  },

  usageCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Number of negotiations that used this insights cache'
  },

  // ========================================
  // AI Processing Metadata
  // ========================================

  aiProcessingTimeMs: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Time taken to generate AI insights'
  },

  aiTokensUsed: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Total tokens used for generating insights'
  },

  aiModel: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'gpt-4',
    comment: 'AI model used for generating insights'
  }

}, {
  tableName: 'CandidateInsights',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['userId']
    },
    {
      fields: ['expiresAt']
    },
    {
      fields: ['generatedAt']
    }
  ]
});

// ========================================
// Instance Methods
// ========================================

/**
 * Check if the cache is still valid
 */
CandidateInsights.prototype.isValid = function() {
  return this.expiresAt > new Date();
};

/**
 * Check if cache needs refresh based on data changes
 */
CandidateInsights.prototype.needsRefresh = function(currentDataHash) {
  if (!this.isValid()) return true;
  if (this.dataSourcesHash !== currentDataHash) return true;
  return false;
};

/**
 * Record usage of this insights cache
 */
CandidateInsights.prototype.recordUsage = async function() {
  this.lastUsedAt = new Date();
  this.usageCount += 1;
  await this.save();
};

/**
 * Add a job-specific assessment to the cache
 */
CandidateInsights.prototype.addJobAssessment = async function(jobId, assessment) {
  const assessments = this.recentJobAssessments || [];
  
  // Remove existing assessment for this job if present
  const filtered = assessments.filter(a => a.jobId !== jobId);
  
  // Add new assessment
  filtered.unshift({
    jobId,
    assessment,
    assessedAt: new Date().toISOString()
  });
  
  // Keep only last 10
  this.recentJobAssessments = filtered.slice(0, 10);
  await this.save();
};

/**
 * Get cached assessment for a specific job
 */
CandidateInsights.prototype.getJobAssessment = function(jobId) {
  const assessments = this.recentJobAssessments || [];
  return assessments.find(a => a.jobId === jobId);
};

// ========================================
// Class Methods
// ========================================

/**
 * Get or create insights for a candidate
 * @param {number} userId - Candidate user ID
 * @param {function} generateFn - Async function to generate insights if needed
 */
CandidateInsights.getOrCreate = async function(userId, generateFn) {
  let insights = await CandidateInsights.findOne({ where: { userId } });
  
  if (!insights || !insights.isValid()) {
    const generated = await generateFn();
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour TTL
    
    if (insights) {
      // Update existing
      await insights.update({
        ...generated,
        generatedAt: new Date(),
        expiresAt,
        regenerationCount: insights.regenerationCount + 1
      });
    } else {
      // Create new
      insights = await CandidateInsights.create({
        userId,
        ...generated,
        generatedAt: new Date(),
        expiresAt
      });
    }
  }
  
  return insights;
};

/**
 * Invalidate cache for a candidate (call when profile/posts change)
 */
CandidateInsights.invalidate = async function(userId) {
  await CandidateInsights.update(
    { expiresAt: new Date() }, // Set to now to force refresh
    { where: { userId } }
  );
};

/**
 * Clean up expired caches
 */
CandidateInsights.cleanupExpired = async function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Delete caches that expired more than 30 days ago and haven't been used
  const deleted = await CandidateInsights.destroy({
    where: {
      expiresAt: {
        [require('sequelize').Op.lt]: thirtyDaysAgo
      },
      lastUsedAt: {
        [require('sequelize').Op.lt]: thirtyDaysAgo
      }
    }
  });
  
  return deleted;
};

module.exports = CandidateInsights;
