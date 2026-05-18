/**
 * Central export file for all TypeScript types
 * 
 * Usage:
 * import { User, Profile, ApiResponse } from '@/types';
 * import type { UserRole, SubscriptionTier } from '@/types';
 */

// User types
export type {
  UserRole,
  SubscriptionTier,
  SubscriptionStatus,
  User,
  UserPublic,
  LoginCredentials,
  RegisterData,
  AuthState,
  AuthActions,
  AuthStore,
  TokenPayload,
} from './user';

// Profile types
export type {
  Skill,
  SkillsMap,
  Experience,
  Education,
  Project,
  Certification,
  Language,
  AvailabilityStatus,
  Profile,
  ProfileWithUser,
  ProfileFormData,
  ProfileFilters,
  AIEnhancementResult,
} from './profile';

// Recruiter types
export type {
  CompanySize,
  HiringStats,
  SalaryRange,
  RecruiterPreferences,
  RecruiterProfile,
  RecruiterProfileWithUser,
  RecruiterProfileFormData,
  MatchScoreBreakdown,
  MatchResult,
  SmartMatchParams,
  JobPosting,
} from './recruiter';

// Subscription types
export type {
  BillingCycle,
  PaymentMethod,
  SubscriptionUserRole,
  UsageStats,
  SubscriptionFeatures,
  Subscription,
  Plan,
  AvailablePlans,
  CheckoutSession,
  SubscriptionUpdateRequest,
  PaymentIntent,
  SubscriptionLimits,
} from './subscription';

export { CANDIDATE_PLANS, RECRUITER_PLANS } from './subscription';

// API types
export type {
  ApiResponse,
  PaginatedResponse,
  ApiError,
  ValidationError,
  AuthResponse,
  UploadResponse,
  ApiRequestConfig,
  QueryParams,
  HttpMethod,
  ApiEndpoint,
  MutationResult,
  HealthCheckResponse,
  RateLimitInfo,
  WebSocketMessage,
} from './api';

export { ApiErrorCode, isApiError, isPaginatedResponse } from './api';
