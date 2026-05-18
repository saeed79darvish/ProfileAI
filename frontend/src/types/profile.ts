/**
 * Profile-related TypeScript types
 */

/**
 * Skill with proficiency level
 */
export interface Skill {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsOfExperience?: number;
  endorsements?: number;
}

/**
 * Skills object (category -> skills array)
 */
export interface SkillsMap {
  [category: string]: Skill[];
}

/**
 * Work experience entry
 */
export interface Experience {
  id?: string;
  company: string;
  title: string;
  location?: string;
  startDate: string;
  endDate?: string | null;
  current: boolean;
  description?: string;
  achievements?: string[];
  technologies?: string[];
}

/**
 * Education entry
 */
export interface Education {
  id?: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string | null;
  current: boolean;
  gpa?: number;
  achievements?: string[];
  activities?: string[];
}

/**
 * Project entry
 */
export interface Project {
  id?: string;
  name: string;
  description: string;
  imageUrl?: string;
  projectUrl?: string;
  githubUrl?: string;
  technologies: string[];
  startDate?: string;
  endDate?: string;
  highlights?: string[];
}

/**
 * Certification entry
 */
export interface Certification {
  id?: string;
  name: string;
  issuer: string;
  issueDate: string;
  expirationDate?: string | null;
  credentialId?: string;
  credentialUrl?: string;
}

/**
 * Language proficiency
 */
export interface Language {
  name: string;
  proficiency: 'basic' | 'conversational' | 'professional' | 'native';
}

/**
 * Availability status
 */
export type AvailabilityStatus = 'open' | 'not-looking' | 'actively-looking';

/**
 * Complete Profile interface matching backend Profile model
 */
export interface Profile {
  id: string;
  userId: string;
  
  // Profile images
  profilePicture?: string | null;
  coverImage?: string | null;
  
  // Basic info
  title: string;
  headline?: string | null;
  location?: string | null;
  phone?: string | null;
  
  // Social links
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  twitterUrl?: string | null;
  websiteUrl?: string | null;
  
  // Content
  summary?: string | null;
  skills: SkillsMap;
  experience: Experience[];
  education: Education[];
  projects: Project[];
  certifications: Certification[];
  languages: Language[];
  
  // Status
  availabilityStatus: AvailabilityStatus;
  isPublic: boolean;
  
  // AI-generated fields
  aiSummary?: string | null;
  aiStrengths?: string[];
  aiRecruiterInsights?: string | null;
  aiKeywords?: string[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Profile with user data (for browse/search results)
 */
export interface ProfileWithUser extends Profile {
  User?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

/**
 * Profile form data for create/update
 */
export interface ProfileFormData {
  title: string;
  headline?: string;
  location?: string;
  phone?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  summary?: string;
  skills?: SkillsMap;
  experience?: Experience[];
  education?: Education[];
  projects?: Project[];
  certifications?: Certification[];
  languages?: Language[];
  availabilityStatus?: AvailabilityStatus;
  isPublic?: boolean;
}

/**
 * Profile search/filter parameters
 */
export interface ProfileFilters {
  search?: string;
  skills?: string[];
  location?: string;
  availabilityStatus?: AvailabilityStatus;
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'lead';
  sortBy?: 'relevance' | 'recent' | 'name';
  page?: number;
  limit?: number;
}

/**
 * AI enhancement result
 */
export interface AIEnhancementResult {
  aiSummary: string;
  aiStrengths: string[];
  aiRecruiterInsights: string;
  aiKeywords: string[];
}
