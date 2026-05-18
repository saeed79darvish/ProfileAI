// Constants for BrowseProfiles

export const ROUTES = {
  PROFILE: '/profile',
  AGENT_ARENA: (id: string | number) => `/agent-arena/${id}`,
  VIEW_PROFILE: (id: string | number) => `/profile/${id}`,
  AI_TOOLS: (id: string | number) => `/recruiter-tools/${id}`,
} as const;

export const COMMON_SKILLS = [
  'JavaScript', 'Python', 'React', 'Node.js', 'TypeScript', 'Java', 'SQL',
  'AWS', 'Docker', 'Git', 'REST APIs', 'GraphQL', 'MongoDB', 'PostgreSQL',
  'HTML/CSS', 'Agile', 'Machine Learning', 'Data Analysis', 'CI/CD',
  'Kubernetes', 'Linux', 'C++', 'Go', 'Rust', 'Swift', 'Kotlin',
  'Ruby', 'PHP', 'Django', 'Flask', 'Spring Boot', 'Express.js',
  'Vue.js', 'Angular', 'Next.js', 'Redux', 'Tailwind CSS',
  'Figma', 'Adobe XD', 'Sketch', 'UI/UX Design', 'Product Design',
  'Project Management', 'Scrum', 'Product Management', 'Business Analysis',
  'Digital Marketing', 'SEO', 'Content Strategy', 'Social Media',
  'Sales', 'Account Management', 'Customer Success', 'Technical Writing',
  'Cybersecurity', 'Networking', 'Cloud Architecture', 'DevOps',
  'Data Engineering', 'ETL', 'Tableau', 'Power BI', 'R',
  'TensorFlow', 'PyTorch', 'NLP', 'Computer Vision', 'Deep Learning',
] as const;

export const EXPERIENCE_LEVELS = [
  { value: 'entry', label: 'Entry Level (0-2 years)' },
  { value: 'mid', label: 'Mid Level (3-5 years)' },
  { value: 'senior', label: 'Senior (6-10 years)' },
  { value: 'lead', label: 'Lead / Manager (10+ years)' },
  { value: 'executive', label: 'Executive' },
] as const;

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'recent', label: 'Most Recent' },
  { value: 'experience', label: 'Most Experienced' },
  { value: 'ai_score', label: 'Highest AI Score' },
] as const;

export const LIMITS = {
  PAGE_SIZE: 12,
  DEBOUNCE_MS: 300,
  SNACKBAR_DURATION: 4000,
  SKELETON_COUNT: 6,
  TOP_SKILLS: 5,
  AI_SCORE_TOP: 70,
  AI_SCORE_ENHANCED: 50,
  COMPLETENESS_HIGH: 80,
  SKELETON_CARD_HEIGHT: 400,
  AVATAR_SIZE: 64,
} as const;

export const AI_WEIGHTS = {
  SKILLS: 25,
  EXPERIENCE: 25,
  EDUCATION: 20,
  COMPLETENESS: 30,
} as const;

export const COMPLETENESS_WEIGHTS = {
  BASICS: 15,
  EXPERIENCE: 25,
  EDUCATION: 15,
  SKILLS: 15,
  DESCRIPTION: 20,
  PHOTO: 10,
} as const;

export const TEXT = {
  HERO_TITLE: 'Discover Top Talent',
  HERO_SUBTITLE: 'AI-powered profiles to help you find the perfect candidates',
  NO_PROFILES: 'No profiles found',
  ADJUST_SEARCH: 'Try adjusting your search terms',
  AI_INSIGHTS: 'AI INSIGHTS',
  TOP_SKILLS: 'TOP SKILLS',
  TOP_CANDIDATE: '⭐ Top Candidate',
  AI_ENHANCED_ONLY: 'AI Enhanced Only',
  VIEW_PROFILE: 'View Profile',
  AI_TOOLS: 'AI Tools',
  SCOUT_AGENT: '🤖 Scout with Agent',
  CLEAR_FILTERS: 'Clear All Filters',
  STAT_ACTIVE: 'Active Profiles',
  STAT_AI: 'AI Enhanced',
  STAT_SKILLS: 'Unique Skills',
  STAT_FREE: 'Free to Browse',
  SEARCH_PLACEHOLDER: "Search by name, title, skills, location... (e.g., 'Marketing Manager in New York')",
  LOAD_ERROR: 'Failed to load profiles:',
} as const;
