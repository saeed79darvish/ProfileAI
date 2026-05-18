export const ROUTES = {
  RECRUITER_PROFILE: '/recruiter/profile',
  RECRUITER_JOBS: '/recruiter/jobs',
  BROWSE: '/browse',
  HOME: '/',
} as const;

export const SLIDES = [
  {
    headline: 'find the perfect candidates.',
    description: 'ProfileAI uses intelligent matching to surface the best candidates for your roles \u2014 ranked by skills, experience, and culture fit.',
    emoji: '\uD83C\uDFAF',
    featureText: 'Smart matching analyzes 50+ data points to find candidates who truly fit your requirements.',
    visual: 'smartMatch'
  },
  {
    headline: 'post jobs & automate screening.',
    description: 'Create job postings with AI-assisted descriptions and let our AI agent conduct initial phone screenings automatically.',
    emoji: '\u26A1',
    featureText: 'AI generates optimized job descriptions and screens candidates with voice interviews.',
    visual: 'jobPost'
  },
  {
    headline: 'manage interviews & hire faster.',
    description: 'Track your entire hiring pipeline from application to offer. Schedule interviews, get AI insights, and make data-driven decisions.',
    emoji: '\uD83D\uDCCB',
    featureText: 'Full pipeline visibility with AI-powered insights at every stage.',
    visual: 'pipeline'
  }
] as const;

export const TEXT = {
  LOGO: 'ProfileAI',
  WELCOME_LABEL: 'ProfileAI for Recruiters',
  WELCOME_PREFIX: 'Welcome,',
  HEADING_PREFIX: 'ProfileAI helps you...',
  GET_STARTED: 'Get Started',
  CONTINUE: 'Continue',
  SKIP: 'Skip intro',
  CHOICE_HEADING: 'Where would you like to start?',
  CHOICE_SUBTITLE: 'Set up your company profile first for the best experience \u2014 or jump right into hiring.',
  SETUP_TITLE: 'Set Up Company Profile',
  SETUP_DESC: 'Add your company details, logo, and culture info to attract better candidates.',
  SETUP_BUTTON: 'Set Up Profile',
  POST_TITLE: 'Post Your First Job',
  POST_DESC: 'Create an AI-optimized job posting and start receiving applications immediately.',
  POST_BUTTON: 'Post a Job',
  BROWSE_TITLE: 'Browse Candidates',
  BROWSE_DESC: 'Search our talent pool and discover candidates matched to your requirements.',
  BROWSE_BUTTON: 'Browse Talent',
} as const;

export const TIMINGS = {
  ANIMATION_DELAY_MS: 300,
} as const;
