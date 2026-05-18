/**
 * Recruiter-related TypeScript types
 */

/**
 * Company size options
 */
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+';

/**
 * Hiring statistics
 */
export interface HiringStats {
  totalProjects: number;
  activeProjects: number;
  totalHires: number;
  averageTimeToHire: number;
}

/**
 * Salary range
 */
export interface SalaryRange {
  min: number;
  max: number;
  currency?: string;
}

/**
 * Recruiter preferences for candidate matching
 */
export interface RecruiterPreferences {
  industries: string[];
  skills: string[];
  locations: string[];
  salaryRange: SalaryRange;
  experienceLevel?: string[];
  remotePreference?: 'remote' | 'hybrid' | 'onsite' | 'any';
}

/**
 * Complete RecruiterProfile interface matching backend model
 */
export interface RecruiterProfile {
  id: string;
  userId: string;
  
  // Company info
  companyName: string;
  companyWebsite?: string | null;
  companySize?: CompanySize | null;
  industry?: string | null;
  companyDescription?: string | null;
  companyLogo?: string | null;
  
  // Personal info
  jobTitle: string;
  location?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  bio?: string | null;
  profilePicture?: string | null;
  
  // Stats and preferences
  hiringStats: HiringStats;
  preferences: RecruiterPreferences;
  
  // Verification
  isVerified: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Recruiter profile with user data
 */
export interface RecruiterProfileWithUser extends RecruiterProfile {
  User?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

/**
 * Form data for recruiter profile create/update
 */
export interface RecruiterProfileFormData {
  companyName: string;
  companyWebsite?: string;
  companySize?: CompanySize;
  industry?: string;
  companyDescription?: string;
  jobTitle: string;
  location?: string;
  phone?: string;
  linkedinUrl?: string;
  bio?: string;
  preferences?: RecruiterPreferences;
}

/**
 * Match score breakdown
 */
export interface MatchScoreBreakdown {
  skillsMatch: number;
  experienceMatch: number;
  locationMatch: number;
  availabilityMatch: number;
  overallScore: number;
}

/**
 * AI-powered match result for candidate matching
 */
export interface MatchResult {
  profileId: string;
  candidateName: string;
  candidateTitle: string;
  candidateLocation?: string;
  profilePicture?: string;
  
  // Match details
  matchScore: number;
  scoreBreakdown: MatchScoreBreakdown;
  
  // AI insights
  matchReasons: string[];
  potentialConcerns?: string[];
  recommendedActions?: string[];
  
  // Candidate highlights
  topSkills: string[];
  yearsOfExperience: number;
  availabilityStatus: string;
  
  // Timestamps
  matchedAt: string;
}

/**
 * Smart match search parameters
 */
export interface SmartMatchParams {
  jobDescription?: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
  location?: string;
  remoteOk?: boolean;
  experienceMin?: number;
  experienceMax?: number;
  limit?: number;
}

/**
 * Job posting (for future use)
 */
export interface JobPosting {
  id: string;
  recruiterId: string;
  title: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  location: string;
  remoteOption: 'remote' | 'hybrid' | 'onsite';
  salaryRange?: SalaryRange;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'internship';
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: string;
  status: 'draft' | 'active' | 'paused' | 'closed';
  createdAt: string;
  updatedAt: string;
}
