// Constants for JobPreferencesWizard

export const ROUTES = {
  PROFILE_CREATE_FORM: '/profile/create-form',
  HOME: '/',
} as const;

export const STEPS = [
  { id: 'identity', label: 'Industry & Role' },
  { id: 'preferences', label: 'Opportunity Type' },
  { id: 'skills', label: 'Skills' },
  { id: 'final', label: 'Final Details' },
] as const;

export const EXPERIENCE_LEVELS = [
  { id: 'entry', label: 'Entry Level', sub: '0-2 years', icon: '🌱' },
  { id: 'mid', label: 'Mid Level', sub: '3-5 years', icon: '🚀' },
  { id: 'senior', label: 'Senior', sub: '6-10 years', icon: '⭐' },
  { id: 'lead', label: 'Lead/Manager', sub: '10+ years', icon: '👑' },
  { id: 'executive', label: 'Executive', sub: 'C-suite', icon: '💎' },
] as const;

export const EMPLOYMENT_TYPES = [
  { id: 'full-time', label: 'Full-time', icon: '💼' },
  { id: 'part-time', label: 'Part-time', icon: '⏰' },
  { id: 'contract', label: 'Contract', icon: '📝' },
  { id: 'freelance', label: 'Freelance', icon: '🌍' },
  { id: 'internship', label: 'Internship', icon: '🎓' },
] as const;

export const AVAILABILITY_OPTIONS = [
  { id: 'immediately', label: 'Immediately', sub: 'Ready to start now', color: '#22c55e' },
  { id: '2_weeks', label: 'In 2 weeks', sub: 'Wrapping up current role', color: '#f59e0b' },
  { id: '1_month', label: 'In 1 month+', sub: 'Open but not urgent', color: '#ef4444' },
  { id: 'casually_browsing', label: 'Casually browsing', sub: 'Just exploring options', color: '#6366f1' },
] as const;

export const AI_TIPS = [
  'A clear title helps recruiters find you 3x faster!',
  'Candidates who specify role type get 40% more relevant matches.',
  'Adding at least 5 skills doubles your profile visibility.',
  'Complete profiles get 5x more recruiter views!',
] as const;

export const LIMITS = {
  DEFAULT_SALARY_MIN: 60000,
  SALARY_MAX: 300000,
  SALARY_STEP: 5000,
  SALARY_K_THRESHOLD: 1000,
  ACTIVE_TITLES_LIMIT: 18,
  SCROLL_MAX_HEIGHT: 300,
  AUTOCOMPLETE_LIMIT: 10,
  TIP_AVATAR_SIZE: 28,
} as const;

export const LOCALSTORAGE_KEY = 'profileai_job_preferences' as const;

export const TEXT = {
  LOGO: 'ProfilleAI',
  SKIP: 'Skip for now \u2192',
  STEP_INDUSTRY: 'What industry are you in?',
  STEP_ROLE: 'What best describes your role?',
  STEP_OPPORTUNITY: 'What kind of opportunities?',
  STEP_SKILLS: 'What are your top skills?',
  STEP_FINAL: 'Almost done \u2014 a few last details',
  BUILD_PROFILE: 'Build My Profile',
  CONTINUE: 'Continue',
  BACK: 'Back',
  SEARCH_SKILLS: 'Search skills...',
  TAP_SKILLS: 'Tap skills below to add them here...',
  SALARY_UNIT: 'USD per year',
} as const;

/* ─── Sector / Title / Skill data ─────────────────────────────── */

export const JOB_SECTORS = [
  { id: 'tech',        icon: '💻', label: 'Tech & Engineering' },
  { id: 'design',      icon: '🎨', label: 'Design & Creative' },
  { id: 'marketing',   icon: '📣', label: 'Marketing & Growth' },
  { id: 'sales',       icon: '🤝', label: 'Sales & BD' },
  { id: 'finance',     icon: '📊', label: 'Finance & Accounting' },
  { id: 'product',     icon: '🧭', label: 'Product & Strategy' },
  { id: 'data',        icon: '📈', label: 'Data & Analytics' },
  { id: 'operations',  icon: '⚙️', label: 'Operations & PM' },
  { id: 'healthcare',  icon: '🩺', label: 'Healthcare' },
  { id: 'education',   icon: '🎓', label: 'Education' },
  { id: 'legal',       icon: '⚖️', label: 'Legal' },
  { id: 'hr',          icon: '🧑‍🤝‍🧑', label: 'People & HR' },
] as const;

export const SECTOR_TITLES: Record<string, string[]> = {
  tech: [
    'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
    'Senior Frontend Engineer', 'Senior Backend Engineer', 'Software Engineer',
    'Mobile Developer (iOS)', 'Mobile Developer (Android)', 'DevOps Engineer',
    'Site Reliability Engineer', 'Cloud Engineer', 'Security Engineer',
    'QA Engineer', 'Engineering Manager', 'Tech Lead', 'Staff Engineer',
    'Machine Learning Engineer', 'AI Engineer',
  ],
  design: [
    'UX Designer', 'UI Designer', 'Product Designer',
    'Senior Product Designer', 'Visual Designer', 'Brand Designer',
    'Motion Designer', 'Illustrator', 'Design Lead',
    'Design Manager', 'UX Researcher', 'Content Designer',
  ],
  marketing: [
    'Marketing Manager', 'Digital Marketing Manager', 'Content Marketer',
    'SEO Specialist', 'Growth Marketer', 'Performance Marketing Manager',
    'Email Marketing Manager', 'Social Media Manager', 'Brand Manager',
    'Product Marketing Manager', 'Head of Marketing', 'CMO',
  ],
  sales: [
    'Sales Development Rep', 'Account Executive', 'Senior Account Executive',
    'Account Manager', 'Customer Success Manager', 'Business Development Rep',
    'Enterprise AE', 'Sales Manager', 'VP of Sales',
  ],
  finance: [
    'Financial Analyst', 'Senior Financial Analyst', 'Accountant',
    'Senior Accountant', 'Controller', 'FP&A Manager',
    'Finance Manager', 'CFO', 'Auditor', 'Tax Specialist',
  ],
  product: [
    'Associate Product Manager', 'Product Manager', 'Senior Product Manager',
    'Group Product Manager', 'Director of Product', 'VP of Product',
    'Product Operations Manager', 'Technical Product Manager',
  ],
  data: [
    'Data Analyst', 'Senior Data Analyst', 'Data Scientist',
    'Senior Data Scientist', 'Data Engineer', 'Analytics Engineer',
    'BI Developer', 'ML Engineer', 'AI Scientist',
  ],
  operations: [
    'Operations Manager', 'Project Manager', 'Program Manager',
    'Technical Program Manager', 'Chief of Staff', 'Business Operations',
    'Strategy & Operations', 'Director of Operations',
  ],
  healthcare: [
    'Registered Nurse', 'Nurse Practitioner', 'Physician',
    'Medical Assistant', 'Pharmacist', 'Physical Therapist',
    'Healthcare Administrator', 'Clinical Research Coordinator',
  ],
  education: [
    'Teacher', 'Curriculum Developer', 'Instructional Designer',
    'Education Coordinator', 'School Counselor', 'Principal',
    'Professor', 'Academic Advisor',
  ],
  legal: [
    'Paralegal', 'Associate Attorney', 'Senior Attorney',
    'Corporate Counsel', 'General Counsel', 'Legal Operations Manager',
    'Compliance Officer', 'Contract Manager',
  ],
  hr: [
    'HR Generalist', 'HR Business Partner', 'Recruiter',
    'Senior Recruiter', 'Talent Acquisition Manager', 'People Operations',
    'HR Manager', 'Head of People', 'Compensation Analyst',
  ],
};

export const ALL_TITLES: string[] = Array.from(
  new Set(Object.values(SECTOR_TITLES).flat())
);

export type SkillCategoryMap = Record<string, string[]>;

export const SECTOR_SKILLS: Record<string, SkillCategoryMap> = {
  tech: {
    Languages: ['JavaScript', 'TypeScript', 'Python', 'Go', 'Java', 'Ruby', 'C#', 'C++', 'Rust', 'PHP', 'Swift', 'Kotlin'],
    Frontend: ['React', 'Vue.js', 'Angular', 'Next.js', 'Svelte', 'Tailwind CSS', 'Redux', 'GraphQL'],
    Backend: ['Node.js', 'Express', 'Django', 'Flask', 'Spring Boot', 'Rails', 'FastAPI', '.NET'],
    'Cloud & DevOps': ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Linux'],
    Databases: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB'],
  },
  design: {
    Tools: ['Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'After Effects', 'Framer', 'Webflow'],
    Disciplines: ['UI Design', 'UX Design', 'Interaction Design', 'Prototyping', 'Wireframing', 'Design Systems', 'Branding', 'Typography'],
    Research: ['User Research', 'Usability Testing', 'A/B Testing', 'Personas', 'Journey Mapping'],
  },
  marketing: {
    Channels: ['SEO', 'SEM', 'Email Marketing', 'Social Media', 'Content Marketing', 'Influencer Marketing', 'Affiliate'],
    Tools: ['Google Analytics', 'HubSpot', 'Marketo', 'Mailchimp', 'Hootsuite', 'SEMrush', 'Ahrefs'],
    Skills: ['Copywriting', 'Brand Strategy', 'Campaign Management', 'A/B Testing', 'CRM', 'Lead Generation'],
  },
  sales: {
    Tools: ['Salesforce', 'HubSpot CRM', 'Outreach', 'Salesloft', 'Gong', 'LinkedIn Sales Navigator'],
    Skills: ['Cold Outreach', 'Discovery Calls', 'Negotiation', 'Pipeline Management', 'Forecasting', 'Account Management', 'Closing'],
  },
  finance: {
    Software: ['Excel', 'QuickBooks', 'NetSuite', 'SAP', 'Oracle Financials', 'Tableau', 'Power BI'],
    Disciplines: ['Financial Modeling', 'Forecasting', 'Budgeting', 'GAAP', 'IFRS', 'Audit', 'Tax', 'M&A'],
  },
  product: {
    Skills: ['Roadmapping', 'User Research', 'A/B Testing', 'OKRs', 'Agile/Scrum', 'Stakeholder Management', 'Go-to-Market'],
    Tools: ['Jira', 'Linear', 'Notion', 'Productboard', 'Amplitude', 'Mixpanel', 'Figma'],
  },
  data: {
    Languages: ['SQL', 'Python', 'R', 'Scala'],
    Tools: ['Tableau', 'Power BI', 'Looker', 'dbt', 'Snowflake', 'Airflow', 'Spark', 'Databricks'],
    'ML & Stats': ['Statistics', 'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision', 'PyTorch', 'TensorFlow', 'scikit-learn'],
  },
  operations: {
    Skills: ['Process Improvement', 'Project Management', 'Vendor Management', 'Supply Chain', 'Lean', 'Six Sigma'],
    Tools: ['Asana', 'Jira', 'Monday', 'Smartsheet', 'Excel', 'SQL'],
  },
  healthcare: {
    Clinical: ['Patient Care', 'EMR/EHR', 'Triage', 'Phlebotomy', 'Vital Signs', 'HIPAA Compliance'],
    Specialties: ['Pediatrics', 'Geriatrics', 'Emergency', 'ICU', 'Oncology', 'Cardiology'],
  },
  education: {
    Skills: ['Curriculum Design', 'Lesson Planning', 'Classroom Management', 'Assessment', 'Differentiated Instruction', 'IEP'],
    Tools: ['Google Classroom', 'Canvas', 'Blackboard', 'Schoology', 'Zoom'],
  },
  legal: {
    Areas: ['Contract Law', 'Corporate Law', 'IP', 'Employment Law', 'Compliance', 'Litigation', 'M&A'],
    Skills: ['Legal Research', 'Drafting', 'Negotiation', 'Due Diligence', 'Westlaw', 'LexisNexis'],
  },
  hr: {
    Skills: ['Recruiting', 'Talent Acquisition', 'Onboarding', 'Performance Management', 'Compensation', 'Employee Relations', 'HRIS'],
    Tools: ['Workday', 'BambooHR', 'Greenhouse', 'Lever', 'ADP', 'LinkedIn Recruiter'],
  },
};

// Flat default skills shown when no sector is selected.
export const ALL_SKILLS: SkillCategoryMap = {
  Communication: ['Written Communication', 'Public Speaking', 'Presentation', 'Storytelling'],
  Leadership: ['Team Leadership', 'Mentoring', 'Coaching', 'Cross-functional Collaboration'],
  Technical: ['JavaScript', 'Python', 'SQL', 'Excel', 'Git'],
  Design: ['Figma', 'UI Design', 'UX Research'],
  Business: ['Strategy', 'Project Management', 'Stakeholder Management', 'Negotiation'],
  Data: ['Analytics', 'Data Visualization', 'A/B Testing'],
};
