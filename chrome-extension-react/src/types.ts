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
  /** Share of the job's keywords the profile already covers, 0-100. */
  matchScore: number;
  /** Fully evidenced. On the AI pass this is `strong` coverage ONLY — half-
   *  credit matches live in `partial`, so the count beside the score can't
   *  claim more evidence than the score was computed from. */
  present: string[];
  /** Requirements with adjacent or dated evidence — half credit in the score.
   *  Absent on the on-device pass, which has no notion of evidence strength. */
  partial?: string[];
  missing: string[];
  totalKeywords: number;
  /** Where this came from. Scoring is on-device now, so 'local' is the normal
   *  case; 'ai' remains for results restored from an older cached task. */
  source?: 'local' | 'ai';
  /** Importance per keyword (lowercased key) from the AI pass. The local pass
   *  has no notion of importance and leaves this undefined. */
  priorities?: Record<string, 'high' | 'medium' | 'low'>;
  /** True when all we have is the vocabulary scan — the posting couldn't be
   *  read into requirements, so there is nothing to score. It compares
   *  vocabulary only, with no notion of title, seniority or evidence, so its
   *  ratio is never shown as a match score. */
  provisional?: boolean;
  /** Why no score was produced, shown to the user verbatim. */
  reason?: string;
  /** Requirements that are stated as required, have no support in the profile,
   *  and are of a kind a screen actually filters on. These are the ones that
   *  fail an ATS; soft skills never appear here. */
  blockers?: Array<{ requirement: string; type: string; why: string }>;
  /** Sub-scores behind the number, so the UI can explain it. */
  components?: {
    roleFit: number;
    /** Weighted share of requirements evidenced — this IS the score, before
     *  role fit, seniority and recency modulate it. */
    coverage: number;
    /** null when the posting stated no requirements of that class; that
     *  dimension was dropped from the score rather than scored as zero. */
    mustCoverage: number | null;
    niceCoverage: number | null;
    seniorityFit: number;
    recency: number;
    mustCount: number;
    niceCount: number;
    /** Requirements with full evidence vs. half credit. */
    strongCount: number;
    partialCount: number;
    /** Requirements that carried weight, and responsibilities that didn't. */
    scoredCount: number;
    unscoredCount: number;
    /** 'dates' when seniority came from the profile's dates against a stated
     *  minimum, 'model' when the posting named no years and we fell back. */
    seniorityBasis: 'dates' | 'model';
    candidateYears: number | null;
    requiredYears: number | null;
    cappedByBlockers: boolean;
  };
  /** Score if tailoring closes every gap it can close honestly. */
  projectedScore?: number;
  /** One sentence on what drove the score. */
  verdict?: string;
  /** Full requirement list with evidence, newest read only. */
  requirements?: Array<{
    requirement: string;
    type: string;
    hardness: 'must' | 'nice';
    coverage: 'strong' | 'partial' | 'none';
    evidence?: string;
  }>;
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
  | 'OPEN_WEB_LOGIN'
  | 'CLOSE_CURRENT_TAB'
  | 'GET_JOB_INFO_RELAY'
  | 'ANALYZE_JOB_PAGE'
  | 'ANALYZE_GAPS'
  | 'SAVE_EXTERNAL_APPLICATION'
  | 'CHECK_AUTH_SILENT'
  | 'SYNC_AUTH_FROM_WEB'
  | 'ANALYZE_KEYWORDS'
  | 'GENERATE_AI_ANSWERS'
  | 'LOGIN_WITH_CREDENTIALS'
  | 'REGISTER'
  | 'AUTH_GOOGLE_INTERACTIVE'
  | 'AUTH_LINKEDIN_INTERACTIVE'
  | 'SAVE_TAILORED_PROFILE'
  | 'REDEEM_PROMO'
  | 'GENERATE_COVER_LETTER'
  | 'AUTOFILL_SUGGEST'
  | 'AUTOFILL_SUGGEST_BATCH'
  | 'DETECT_QUESTIONS'
  | 'GENERATE_SMART_ANSWERS'
  | 'GENERATE_SINGLE_ANSWER'
  | 'INSERT_ANSWER'
  | 'ANALYZE_MATCH'
  | 'ANALYZE_LINKEDIN_PROFILE'
  | 'ANALYZE_LINKEDIN_PROFILE_GUEST'
  | 'SUBMIT_GUEST_REPORT_EMAIL'
  | 'ANALYTICS_EVENT'
  | 'OPEN_LINKEDIN_EDITOR'
  | 'REWRITE_FIELD';

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

// LinkedIn Profile Analyzer — scraped from the current linkedin.com/in/* tab
// via the background service worker's scripting API. All fields optional
// because LinkedIn's DOM changes frequently and sections may be collapsed.
export interface LinkedInProfileScrape {
  url?: string;
  name?: string;
  headline?: string;
  location?: string;
  currentTitle?: string;
  currentCompany?: string;
  about?: string;
  experience?: string;
  education?: string;
  skills?: string;
  featuredCount?: number | null;
  recommendationsCount?: number | null;
  followers?: string;
  connections?: string;
  /** Fallback: page innerText, truncated. Sent when structured selectors fail. */
  rawText?: string;
}

export interface LinkedInSectionAnalysis {
  name: string;
  score: number;
  current?: string;
  findings: string[];
  suggestion?: string;
}

export interface LinkedInProfileAnalysis {
  overallScore: number;
  recruiterFitScore: number;
  searchVisibilityScore: number;
  verdict: 'shortlist' | 'maybe' | 'pass' | string;
  summary?: string;
  sections: LinkedInSectionAnalysis[];
  recruiterSearch: {
    targetTitle?: string;
    presentKeywords: string[];
    missingKeywords: string[];
    recommendedKeywords: string[];
    searchabilityTips: string[];
  };
  priorityFixes: string[];
}

// Guest teaser variant — what the /analyze-linkedin-guest endpoint returns
// to unauthenticated clients. Explicitly NOT a subset of
// LinkedInProfileAnalysis: `sections`, `recruiterSearch` and full
// `priorityFixes` are intentionally absent from the wire because the plan
// requires teaser gating to be server-side (no CSS-only hide).
export interface LinkedInQuickWinLocked {
  index: number;
  title: string;
  /** Present only on the unlocked item (index 0). */
  body?: string;
  locked: boolean;
}

export interface LinkedInProfileAnalysisTeaser {
  mode: 'guest';
  overallScore: number;
  recruiterFitScore: number;
  searchVisibilityScore: number;
  verdict: 'shortlist' | 'maybe' | 'pass' | string;
  summary?: string;
  quickWinsLocked: LinkedInQuickWinLocked[];
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
