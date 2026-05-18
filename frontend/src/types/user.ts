/**
 * User-related TypeScript types
 */

// User roles in the system
export type UserRole = 'candidate' | 'recruiter' | 'admin';

// Subscription tiers
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

// Subscription status
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trial';

/**
 * Base User interface matching backend User model
 */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * User data returned from login/register (without sensitive fields)
 */
export interface UserPublic {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration data
 */
export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

/**
 * Auth state for Zustand store
 */
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Auth actions for Zustand store
 */
export interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setToken: (token: string) => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

/**
 * Combined auth store type
 */
export type AuthStore = AuthState & AuthActions;

/**
 * JWT token payload
 */
export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}
