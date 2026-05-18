// Type definitions for ProfileAI Extension

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'candidate' | 'recruiter';
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  profilePictureUrl?: string;
}

export interface Profile {
  id: string;
  userId: string;
  title?: string;
  headline?: string;
  location?: string;
  phone?: string;
  summary?: string;
  skills?: string[];
  experience?: Experience[];
  education?: Education[];
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  profilePicture?: string;
}

export interface Experience {
  id?: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export interface Education {
  id?: string;
  school: string;
  degree: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface JobInfo {
  title: string;
  company: string;
  description: string;
  location?: string;
  url?: string;
}

export interface TailoredProfile {
  id: string;
  summary: string;
  skills: string[];
  experience: Experience[];
  jobTitle: string;
  jobCompany: string;
  createdAt: string;
}

export interface SavedAnswer {
  question: string;
  answer: string;
}

export interface KeywordAnalysis {
  score: number;
  present: string[];
  missing: string[];
  suggestions: string[];
}

// Message types for chrome.runtime messaging
export type MessageType =
  | 'GET_AUTH'
  | 'LOGIN'
  | 'LOGOUT'
  | 'GET_PROFILE'
  | 'GET_SAVED_ANSWERS'
  | 'SAVE_ANSWER'
  | 'DELETE_ANSWER'
  | 'CLEAR_ANSWERS'
  | 'GET_SEED_ANSWERS'
  | 'SAVE_SEED_ANSWERS'
  | 'GET_ONBOARDING_STATUS'
  | 'OPEN_ONBOARDING'
  | 'GET_JOB_INFO'
  | 'TRIGGER_AUTOFILL'
  | 'TRIGGER_TAILOR'
  | 'TAILOR_PROFILE'
  | 'OPEN_SIDE_PANEL'
  | 'OPEN_TAB'
  | 'CHECK_AUTH_SILENT'
  | 'SYNC_AUTH_FROM_WEB'
  | 'ANALYZE_KEYWORDS'
  | 'GENERATE_AI_ANSWERS'
  | 'LOGIN_WITH_CREDENTIALS'
  | 'REGISTER'
  | 'SAVE_TAILORED_PROFILE'
  | 'REDEEM_PROMO'
  | 'GENERATE_COVER_LETTER'
  | 'AUTOFILL_SUGGEST'
  | 'AUTOFILL_SUGGEST_BATCH'
  | 'DETECT_QUESTIONS'
  | 'GENERATE_SMART_ANSWERS'
  | 'GENERATE_SINGLE_ANSWER'
  | 'INSERT_ANSWER'
  | 'ANALYZE_MATCH';

export interface DetectedQuestion {
  /** Stable ID generated in content script (hash of question + form path) */
  id: string;
  /** The question/label text shown next to the field. */
  question: string;
  /** Field type: textarea | longtext | contenteditable */
  fieldType: 'textarea' | 'longtext' | 'contenteditable';
  /** Optional placeholder/hint text. */
  placeholder?: string;
  /** Approximate field index (DOM order). */
  index: number;
  /** Whether the field already has user content (skip if true). */
  hasContent?: boolean;
}

export interface SmartAnswer {
  questionId: string;
  question: string;
  answer: string;
  source: 'cache' | 'saved' | 'ai';
  /** Whether the user has edited the AI-generated answer. */
  edited?: boolean;
  /** Loading state during regeneration. */
  loading?: boolean;
  error?: string;
}

export interface MatchAnalysis {
  matchScore: number;
  alignments: string[];
  gaps: string[];
  talkingPoints: string[];
  summary?: string;
}

export interface Message {
  type: MessageType;
  data?: unknown;
}

// Seed answers for personalized AI responses
export interface SeedAnswers {
  career_motivation?: string;
  ideal_role?: string;
  career_goals?: string;
  proudest_achievement?: string;
  unique_strength?: string;
  work_style?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
}

// Combined profile with user data (what we store/display)
export interface FullProfile extends Profile {
  firstName?: string;
  lastName?: string;
  email?: string;
}
