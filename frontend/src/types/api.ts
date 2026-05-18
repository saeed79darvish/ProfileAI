/**
 * API-related TypeScript types
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
}

/**
 * Paginated response for list endpoints
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  message?: string;
}

/**
 * API error response
 */
export interface ApiError {
  success: false;
  message: string;
  error?: string;
  errors?: ValidationError[];
  statusCode: number;
  timestamp?: string;
  path?: string;
}

/**
 * Validation error detail
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Auth response (login/register)
 */
export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    subscriptionTier: string;
  };
  message?: string;
}

/**
 * File upload response
 */
export interface UploadResponse {
  success: boolean;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  message?: string;
}

/**
 * API request configuration
 */
export interface ApiRequestConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  withCredentials?: boolean;
}

/**
 * Query parameters for list endpoints
 */
export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * API endpoint definition
 */
export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  requiresAuth: boolean;
  description?: string;
}

/**
 * Mutation result (for React Query mutations)
 */
export interface MutationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    redis?: 'up' | 'down';
    openai?: 'up' | 'down';
  };
  version?: string;
}

/**
 * Rate limit info (from headers)
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * WebSocket message types
 */
export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
}

/**
 * Error codes for client-side handling
 */
export enum ApiErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
}

/**
 * Type guard for API error
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'success' in error &&
    (error as ApiError).success === false &&
    'message' in error
  );
}

/**
 * Type guard for paginated response
 */
export function isPaginatedResponse<T>(
  response: unknown
): response is PaginatedResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'pagination' in response &&
    'data' in response &&
    Array.isArray((response as PaginatedResponse<T>).data)
  );
}
