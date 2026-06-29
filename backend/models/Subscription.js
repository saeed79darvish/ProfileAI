const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subscription = sequelize.define('Subscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  planType: {
    // 'enterprise' is retained for legacy rows; new candidate signups use
    // 'pro_plus'. A migration adds these values to the Postgres ENUM.
    type: DataTypes.ENUM('free', 'starter', 'pro', 'pro_plus', 'enterprise'),
    allowNull: false
  },
  userRole: {
    type: DataTypes.ENUM('candidate', 'recruiter'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'cancelled', 'expired', 'trial'),
    defaultValue: 'active'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'USD'
  },
  billingCycle: {
    type: DataTypes.ENUM('monthly', 'yearly'),
    defaultValue: 'monthly'
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  stripeSubscriptionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  stripeCustomerId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  paymentMethod: {
    type: DataTypes.ENUM('stripe', 'paypal', 'apple_pay'),
    allowNull: true
  },
  features: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  usageStats: {
    type: DataTypes.JSONB,
    defaultValue: {
      aiCreditsUsed: 0,
      aiCreditsLimit: 0,
      profileViewsUsed: 0,
      profileViewsLimit: 0
    }
  }
}, {
  timestamps: true
});

// Subscription Plans Configuration
// Candidate-only for now (recruiter features coming soon)
const SUBSCRIPTION_PLANS = {
  candidate: {
    free: {
      name: 'Free',
      price: 0,
      yearlyPrice: 0,
      features: {
        profileCreation: true,
        basicAIEnhancement: true,
        communityAccess: true,
        profileViews: 50,
        jobAlerts: false,
        prioritySupport: false,
        advancedAI: false,
        coverLetterGen: true,
        resumeTailoring: true,
        watermarkedExports: true,
        applyPilotAuto: false
      },
      limits: {
        resume_parse: '2/month',
        profile_enhance: '2/month',
        tailor_profile: '5/month',
        cover_letter: '5/month',
        career_suggestions: '10/month'
      }
    },
    starter: {
      name: 'Starter',
      price: 6.99,
      yearlyPrice: 55.99, // ~$4.67/mo (save ~33%)
      features: {
        profileCreation: true,
        basicAIEnhancement: true,
        communityAccess: true,
        profileViews: 100,
        jobAlerts: true,
        prioritySupport: false,
        advancedAI: false,
        coverLetterGen: true,
        resumeTailoring: true,
        watermarkedExports: false,
        applyPilotAuto: false
      },
      limits: {
        resume_parse: '5/month',
        profile_enhance: '10/month',
        tailor_profile: '20/month',
        cover_letter: '20/month',
        career_suggestions: 'Unlimited'
      }
    },
    pro: {
      name: 'Pro',
      price: 14.99,
      yearlyPrice: 119.00, // ~$9.92/mo (save ~34%)
      features: {
        profileCreation: true,
        basicAIEnhancement: true,
        communityAccess: true,
        profileViews: 500,
        jobAlerts: true,
        prioritySupport: true,
        advancedAI: true,
        coverLetterGen: true,
        resumeTailoring: true,
        advancedAnalytics: true,
        noDailyCaps: true,
        watermarkedExports: false,
        applyPilotAuto: false
      },
      limits: {
        resume_parse: '20/month',
        profile_enhance: '30/month',
        tailor_profile: '50/month',
        cover_letter: '30/month',
        career_suggestions: 'Unlimited'
      }
    },
    pro_plus: {
      name: 'Pro+',
      price: 29.99,
      yearlyPrice: 239.00, // ~$19.92/mo (save ~34%)
      features: {
        profileCreation: true,
        basicAIEnhancement: true,
        communityAccess: true,
        profileViews: -1,
        jobAlerts: true,
        prioritySupport: true,
        advancedAI: true,
        coverLetterGen: true,
        resumeTailoring: true,
        advancedAnalytics: true,
        noDailyCaps: true,
        watermarkedExports: false,
        applyPilotAuto: true,
        applyPilotWeeklyLimit: 30,
        interviewPrepUnlimited: true,
        batchTailoring: true
      },
      limits: {
        resume_parse: '50/month',
        profile_enhance: '100/month',
        tailor_profile: '200/month',
        cover_letter: '200/month',
        career_suggestions: 'Unlimited',
        applypilot_auto: '30/week'
      }
    },
    // Legacy — kept so existing 'enterprise' rows still resolve. Treat as
    // an internal alias for pro_plus going forward; not exposed in UI.
    enterprise: {
      name: 'Enterprise (legacy)',
      price: 49.99,
      yearlyPrice: 499.88,
      legacy: true,
      features: {
        profileCreation: true,
        basicAIEnhancement: true,
        unlimitedAI: true,
        communityAccess: true,
        profileViews: -1,
        jobAlerts: true,
        prioritySupport: true,
        advancedAI: true,
        coverLetterGen: true,
        resumeTailoring: true,
        advancedAnalytics: true,
        noDailyCaps: true,
        applyPilotAuto: true,
        personalCareerCoach: true
      },
      limits: {
        resume_parse: 'Unlimited',
        profile_enhance: 'Unlimited',
        tailor_profile: 'Unlimited',
        cover_letter: 'Unlimited'
      }
    }
  },
  // Recruiter plans (coming soon — kept for future use)
  recruiter: {
    free: {
      name: 'Free',
      price: 0,
      features: {
        activeProjects: 1,
        aiCredits: 5,
        candidateViews: 25,
        basicMatching: true
      }
    },
    pro: {
      name: 'Recruiter Pro',
      price: 79.00,
      yearlyPrice: 790.00,
      features: {
        activeProjects: 10,
        aiCredits: 200,
        candidateViews: 1000,
        basicMatching: true,
        advancedFilters: true
      }
    },
    enterprise: {
      name: 'Recruiter Growth',
      price: 199.00,
      yearlyPrice: 1990.00,
      features: {
        activeProjects: 50,
        aiCredits: -1,
        candidateViews: -1,
        basicMatching: true,
        advancedFilters: true,
        atsIntegration: true,
        phoneScreening: true
      }
    }
  }
};

Subscription.PLANS = SUBSCRIPTION_PLANS;

module.exports = Subscription;
