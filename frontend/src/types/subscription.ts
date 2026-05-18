/**
 * Subscription-related TypeScript types
 */

import type { SubscriptionTier, SubscriptionStatus } from './user';

/**
 * Re-export for convenience
 */
export type { SubscriptionTier, SubscriptionStatus };

/**
 * Billing cycle options
 */
export type BillingCycle = 'monthly' | 'yearly';

/**
 * Payment method options
 */
export type PaymentMethod = 'stripe' | 'paypal' | 'apple_pay';

/**
 * User role for subscription context
 */
export type SubscriptionUserRole = 'candidate' | 'recruiter';

/**
 * Usage statistics for subscription
 */
export interface UsageStats {
  aiCreditsUsed: number;
  aiCreditsLimit: number;
  profileViewsUsed: number;
  profileViewsLimit: number;
  resumeDownloadsUsed?: number;
  resumeDownloadsLimit?: number;
  smartMatchesUsed?: number;
  smartMatchesLimit?: number;
}

/**
 * Feature flags for subscription tier
 */
export interface SubscriptionFeatures {
  aiEnhancement: boolean;
  aiCreditsPerMonth: number;
  resumeDownload: boolean;
  resumeFormats: string[];
  profileViews: boolean | 'unlimited';
  profileViewsPerMonth: number;
  smartMatch: boolean;
  smartMatchesPerMonth: number;
  prioritySupport: boolean;
  customBranding: boolean;
  analytics: boolean;
  apiAccess: boolean;
  bulkExport: boolean;
}

/**
 * Complete Subscription interface matching backend model
 */
export interface Subscription {
  id: string;
  userId: string;
  planType: SubscriptionTier;
  userRole: SubscriptionUserRole;
  status: SubscriptionStatus;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  startDate: string;
  endDate: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  paymentMethod: PaymentMethod | null;
  features: SubscriptionFeatures;
  usageStats: UsageStats;
  createdAt: string;
  updatedAt: string;
}

/**
 * Subscription plan definition
 */
export interface Plan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  userRole: SubscriptionUserRole;
  description: string;
  features: string[];
  featuresConfig: SubscriptionFeatures;
  pricing: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  isPopular?: boolean;
  isBestValue?: boolean;
}

/**
 * Available plans grouped by role
 */
export interface AvailablePlans {
  candidate: Plan[];
  recruiter: Plan[];
}

/**
 * Checkout session data
 */
export interface CheckoutSession {
  sessionId: string;
  url: string;
}

/**
 * Subscription update request
 */
export interface SubscriptionUpdateRequest {
  planType: SubscriptionTier;
  billingCycle: BillingCycle;
  paymentMethod?: PaymentMethod;
}

/**
 * Payment intent data
 */
export interface PaymentIntent {
  clientSecret: string;
  amount: number;
  currency: string;
}

/**
 * Subscription limits for gating features
 */
export interface SubscriptionLimits {
  tier: SubscriptionTier;
  canUseAI: boolean;
  remainingAICredits: number;
  canDownloadResume: boolean;
  canViewProfiles: boolean;
  remainingProfileViews: number;
  canUseSmartMatch: boolean;
  remainingSmartMatches: number;
}

/**
 * Candidate subscription plans configuration
 */
export const CANDIDATE_PLANS: Plan[] = [
  {
    id: 'candidate-free',
    name: 'Free',
    tier: 'free',
    userRole: 'candidate',
    description: 'Get started with basic features',
    features: [
      'Create your profile',
      'Basic profile visibility',
      '3 AI enhancements per month',
      'PDF resume download',
    ],
    featuresConfig: {
      aiEnhancement: true,
      aiCreditsPerMonth: 3,
      resumeDownload: true,
      resumeFormats: ['pdf'],
      profileViews: true,
      profileViewsPerMonth: 100,
      smartMatch: false,
      smartMatchesPerMonth: 0,
      prioritySupport: false,
      customBranding: false,
      analytics: false,
      apiAccess: false,
      bulkExport: false,
    },
    pricing: { monthly: 0, yearly: 0, currency: 'USD' },
  },
  {
    id: 'candidate-pro',
    name: 'Pro',
    tier: 'pro',
    userRole: 'candidate',
    description: 'Advanced features for serious job seekers',
    features: [
      'Unlimited AI enhancements',
      'Multiple resume formats',
      'Priority in search results',
      'Analytics dashboard',
      'Priority support',
    ],
    featuresConfig: {
      aiEnhancement: true,
      aiCreditsPerMonth: 50,
      resumeDownload: true,
      resumeFormats: ['pdf', 'docx', 'txt'],
      profileViews: 'unlimited',
      profileViewsPerMonth: -1,
      smartMatch: true,
      smartMatchesPerMonth: 20,
      prioritySupport: true,
      customBranding: false,
      analytics: true,
      apiAccess: false,
      bulkExport: false,
    },
    pricing: { monthly: 9.99, yearly: 99.99, currency: 'USD' },
    isPopular: true,
  },
  {
    id: 'candidate-enterprise',
    name: 'Enterprise',
    tier: 'enterprise',
    userRole: 'candidate',
    description: 'Everything you need for career success',
    features: [
      'Everything in Pro',
      'Custom branding',
      'API access',
      'Dedicated support',
      'Bulk export',
    ],
    featuresConfig: {
      aiEnhancement: true,
      aiCreditsPerMonth: -1, // unlimited
      resumeDownload: true,
      resumeFormats: ['pdf', 'docx', 'txt', 'json'],
      profileViews: 'unlimited',
      profileViewsPerMonth: -1,
      smartMatch: true,
      smartMatchesPerMonth: -1,
      prioritySupport: true,
      customBranding: true,
      analytics: true,
      apiAccess: true,
      bulkExport: true,
    },
    pricing: { monthly: 29.99, yearly: 299.99, currency: 'USD' },
    isBestValue: true,
  },
];

/**
 * Recruiter subscription plans configuration
 */
export const RECRUITER_PLANS: Plan[] = [
  {
    id: 'recruiter-free',
    name: 'Free',
    tier: 'free',
    userRole: 'recruiter',
    description: 'Basic recruiting tools',
    features: [
      'Browse candidate profiles',
      '10 profile views per month',
      'Basic search filters',
    ],
    featuresConfig: {
      aiEnhancement: false,
      aiCreditsPerMonth: 0,
      resumeDownload: false,
      resumeFormats: [],
      profileViews: true,
      profileViewsPerMonth: 10,
      smartMatch: false,
      smartMatchesPerMonth: 0,
      prioritySupport: false,
      customBranding: false,
      analytics: false,
      apiAccess: false,
      bulkExport: false,
    },
    pricing: { monthly: 0, yearly: 0, currency: 'USD' },
  },
  {
    id: 'recruiter-pro',
    name: 'Pro',
    tier: 'pro',
    userRole: 'recruiter',
    description: 'Professional recruiting toolkit',
    features: [
      '100 profile views per month',
      'AI-powered smart matching',
      'Download candidate resumes',
      'Advanced search filters',
      'Analytics dashboard',
    ],
    featuresConfig: {
      aiEnhancement: true,
      aiCreditsPerMonth: 20,
      resumeDownload: true,
      resumeFormats: ['pdf', 'docx'],
      profileViews: true,
      profileViewsPerMonth: 100,
      smartMatch: true,
      smartMatchesPerMonth: 50,
      prioritySupport: true,
      customBranding: false,
      analytics: true,
      apiAccess: false,
      bulkExport: false,
    },
    pricing: { monthly: 49.99, yearly: 499.99, currency: 'USD' },
    isPopular: true,
  },
  {
    id: 'recruiter-enterprise',
    name: 'Enterprise',
    tier: 'enterprise',
    userRole: 'recruiter',
    description: 'Full-featured enterprise solution',
    features: [
      'Unlimited profile views',
      'Unlimited smart matching',
      'API access',
      'Custom branding',
      'Bulk export',
      'Dedicated support',
    ],
    featuresConfig: {
      aiEnhancement: true,
      aiCreditsPerMonth: -1,
      resumeDownload: true,
      resumeFormats: ['pdf', 'docx', 'txt', 'json'],
      profileViews: 'unlimited',
      profileViewsPerMonth: -1,
      smartMatch: true,
      smartMatchesPerMonth: -1,
      prioritySupport: true,
      customBranding: true,
      analytics: true,
      apiAccess: true,
      bulkExport: true,
    },
    pricing: { monthly: 199.99, yearly: 1999.99, currency: 'USD' },
    isBestValue: true,
  },
];
