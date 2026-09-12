// Copy for the intro that now runs inside the coach conversation.
//
// This used to be the standalone /onboarding page (three feature slides, then
// a two-card "where would you like to start?" fork). Everything after "Get
// Started" happens in the chat now, so the slides are coach messages and the
// fork collapsed to the single card that was always the real path: build the
// profile. /onboarding redirects to /profile/create — see App.jsx.

export const SLIDES = [
  {
    id: 'profile',
    headline: 'build an AI-enhanced profile.',
    description: 'Upload your resume or start from scratch — ProfilleAI will help you build a standout profile that you can use with the ProfilleAI Extension to apply for any job or get noticed by recruiters.',
    emoji: '✨',
    featureText: 'Have a resume? Upload it. Starting fresh? No problem — ProfilleAI guides you either way.',
    visual: 'profile'
  },
  {
    id: 'jobs',
    headline: 'get matched to the right jobs.',
    description: 'ProfilleAI recommends jobs based on your skills and preferences — browse, filter, and apply to roles that actually fit you.',
    emoji: '🔍',
    featureText: 'Tell us your preferences and ProfilleAI will surface roles that truly match your background.',
    visual: 'jobs'
  },
  {
    id: 'tailor',
    headline: 'tailor your profile for every application.',
    description: 'Use ProfilleAI to customize your profile for each job with intelligent keyword optimization — pass ATS filters and stand out.',
    emoji: '📝',
    featureText: 'ProfilleAI identifies missing keywords and adapts your profile to match job requirements instantly.',
    visual: 'tailor'
  }
] as const;

export const INTRO_TEXT = {
  WELCOME: 'Welcome to ProfilleAI!',
  WELCOME_HINT: 'A quick look at what I can do, then we start.',
  HEADING_PREFIX: 'ProfilleAI can help you...',
  CONTINUE: 'Continue',
  SKIP: 'Skip intro',
  PROGRESS_LABEL: 'Intro progress',
  STEP_LABEL: (n: number, total: number) => `Step ${n} of ${total}`,

  START_BUBBLE: "Let's start with your profile.",
  START_HINT: 'Everything else runs off it. It takes about two minutes.',
  BUILD_TITLE: 'Build Your AI Profile',
  BUILD_DESCRIPTION: 'Upload your resume or start from scratch, ProfilleAI helps you create a standout profile to use with the Extension and apply for jobs.',
  BUILD_BUTTON: 'Build Your Profile',
} as const;
