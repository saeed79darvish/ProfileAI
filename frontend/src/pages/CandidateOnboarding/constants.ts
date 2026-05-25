export const ROUTES = {
  PROFILE_CREATE: '/profile/create',
  JOBS: '/jobs',
  HOME: '/',
} as const;

export const SLIDES = [
  {
    headline: 'build an AI-enhanced profile.',
    description: 'Upload your resume or start from scratch \u2014 ProfilleAI will help you build a standout profile that you can use with the ProfilleAI Extension to apply for any job or get noticed by recruiters.',
    emoji: '\u2728',
    featureText: 'Have a resume? Upload it. Starting fresh? No problem \u2014 ProfilleAI guides you either way.',
    visual: 'profile'
  },
  {
    headline: 'get matched to the right jobs.',
    description: 'ProfilleAI recommends jobs based on your skills and preferences \u2014 browse, filter, and apply to roles that actually fit you.',
    emoji: '\uD83D\uDD0D',
    featureText: 'Tell us your preferences and ProfilleAI will surface roles that truly match your background.',
    visual: 'jobs'
  },
  {
    headline: 'tailor your profile for every application.',
    description: 'Use ProfilleAI to customize your profile for each job with intelligent keyword optimization \u2014 pass ATS filters and stand out.',
    emoji: '\uD83D\uDCDD',
    featureText: 'ProfilleAI identifies missing keywords and adapts your profile to match job requirements instantly.',
    visual: 'tailor'
  }
] as const;

export const TEXT = {
  LOGO: 'ProfilleAI',
  WELCOME: 'Welcome to ProfilleAI!',
  HEADING_PREFIX: 'ProfilleAI can help you...',
  GET_STARTED: 'Get Started',
  CONTINUE: 'Continue',
  SKIP: 'Skip intro',
  CHOICE_HEADING: 'Where would you like to start?',
  CHOICE_SUBTITLE: "Don't worry \u2014 you can always do the other one later!",
  BUILD_TITLE: 'Build Your AI Profile',
  BUILD_DESCRIPTION: 'Create a professional profile enhanced by AI. Upload your resume for instant parsing or build from scratch.',
  BUILD_BUTTON: 'Build AI Profile',
  BROWSE_TITLE: 'Browse & Apply to Jobs',
  BROWSE_COMING_SOON: 'Coming Soon',
  BROWSE_DESCRIPTION: 'Explore curated job listings matched to your skills. Apply directly with your AI-enhanced profile.',
  BROWSE_BUTTON: 'Browse Jobs',
} as const;

export const TIMINGS = {
  ANIMATION_DELAY_MS: 300,
} as const;
