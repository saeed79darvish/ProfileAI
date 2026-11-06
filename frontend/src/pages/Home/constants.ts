// Constants for Home
import { COLORS, GRADIENTS, RADIUS } from '../../designTokens';

export const ROUTES = {
  REGISTER: '/register',
  BROWSE: '/browse',
  RECRUITER_DASHBOARD: '/recruiter/dashboard',
  PROFILE: '/profile',
  FEED: '/feed',
  PRICING: '/pricing',
  PRIVACY: '/privacy',
  TERMS: '/terms',
} as const;

export const TOKENS = {
  primary: COLORS.PRIMARY,
  secondary: COLORS.PRIMARY_DARK,
  dark: '#0d0219',
  darkBg: COLORS.BG_DARK,
  surfaceDark: '#12101f',
  gradient: GRADIENTS.PRIMARY,
  gradientText: `linear-gradient(135deg, ${COLORS.PRIMARY} 30%, ${COLORS.ACCENT_PURPLE} 60%, ${COLORS.PRIMARY_DARK} 100%)`,
  lightBg: '#F8FAFC',
  border: 'rgba(102, 126, 234, 0.12)',
  borderHover: 'rgba(102, 126, 234, 0.3)',
  textPrimary: COLORS.TEXT_PRIMARY,
  textSecondary: '#64748b',
  radius: RADIUS.ROUND,
  radiusSm: RADIUS.LARGE,
} as const;

// ── Hero Section ──
export const HERO_CHIP_LABEL = 'AI Job Search Copilot';
export const HERO_TITLE_PARTS = { prefix: 'Find the jobs that are ', highlight: 'actually hiring', suffix: ', and actually fit you.' } as const;
export const HERO_SUBTITLE = 'Talk it through with Remi, your AI career coach, and ProfilleAI builds your profile. Then it searches a live feed of jobs for you, ranks them by fit, flags postings nobody is hiring for, and tailors your resume and cover letter to each one. The Chrome extension works on the job sites you already use, and the Claude connector lets you search jobs from Claude.';

export const HERO_BUTTONS = {
  GET_STARTED: 'Build my profile, free',
  BROWSE_JOBS: 'Browse Jobs',
  MY_DASHBOARD: 'My Dashboard',
  FIND_TALENT: 'Find Talent',
  MY_PROFILE: 'My Profile',
} as const;

export const TRUST_INDICATORS = [
  { text: 'No account needed to start' },
  { text: 'No credit card' },
  { text: 'Your resume, your words' },
] as const;
export const HERO_EXAMPLE_TAG = 'Example';

// ── Hero Visual Demo Cards ──
export const HERO_PROFILE_CARD = {
  name: 'Sarah Chen',
  role: 'Senior Engineer',
  skills: ['React', 'TypeScript'],
} as const;

export const HERO_MAIN_CARD = { title: 'Job Match', subtitle: 'Tailored to your profile' } as const;

export const HERO_AI_INSIGHT = { label: 'Remi', text: '"Two of your roles have no numbers. Let\'s add them."' } as const;

export const HERO_JOB_CARD = {
  label: '🚀 New Match',
  time: 'Just now',
  title: 'Staff Engineer',
  company: 'Vercel • Remote, US',
  skills: ['React', 'Next.js', 'TypeScript'],
  matchScore: '94%',
  matchLabel: 'Match Score',
} as const;

// ── Feature Tabs ──
export const FEATURE_SECTION = {
  chip: 'Platform Features',
  titlePrefix: 'Everything you need to ',
  titleHighlight: 'land your dream job',
  subtitle: 'One profile, built by talking, that tailors your resume, matches you to real openings and gives recruiters a link worth opening.',
  tryFree: 'Try it free',
} as const;

export const FEATURE_TABS_DATA = [
  {
    id: 'coach', label: 'Career Coach',
    headline: 'Skip the blank form. Just talk.',
    description: 'Remi asks one question at a time, reads your resume if you have one, and shows you what is thin before a recruiter does. Chat, dictate, or import from your resume or LinkedIn.',
    bullets: ['Counts the gaps: roles with no bullets, bullets with no numbers', 'A career analysis with a plan to close the gaps', 'A live voice session when you would rather talk', 'Build the whole profile before you make an account'],
    color: COLORS.PRIMARY,
  },
  {
    id: 'tailor', label: 'AI Tailoring',
    headline: 'Tailor your resume to any job in seconds',
    description: 'Our AI reads the job description and restructures your profile to lead with the most relevant skills and experience, in your own words, so your match score goes up.',
    bullets: ['Match score analysis with gap detection', 'Smart keyword optimization', 'A matching cover letter for each job', 'Download as PDF or Word'],
    color: '#8b9bf0',
  },
  {
    id: 'matching', label: 'Job Matching',
    headline: 'Jobs picked for your profile, not for the algorithm',
    description: 'We score every listing against your living profile, surface the roles you actually fit, and flag postings that look like ghost jobs so you spend your effort where someone is really hiring.',
    bullets: ['Match score on every listing', 'Ghost-job likelihood scoring', 'Skills gap analysis before you apply', 'Tailor your resume from the same place'],
    color: '#a78bfa',
  },
  {
    id: 'profile', label: 'Public Profile',
    headline: 'One link that shows your work',
    description: 'Every profile gets a clean, shareable page with your experience, skills and a downloadable resume PDF, so a recruiter sees you at your best without opening an attachment.',
    bullets: ['A link anyone can open, no login to view', 'Resume PDF in one click', 'A Contact button that opens email', 'Made to read well on a phone'],
    color: COLORS.SUCCESS,
  },
] as const;

// Feature tab demo data. Every demo is a sample, not a real person.
export const COACH_DEMO = {
  label: 'Remi', sample: 'Sample',
  remi: 'Two of your three roles have no numbers. Want to add a result to your most recent one first?',
  you: 'Yes. We cut load time by about a quarter.',
  chips: ['Add a number', 'Skip for now'],
} as const;
export const TAILOR_DEMO = {
  label: 'Tailored Result', sample: 'Sample', score: '92%', role: 'Senior Frontend Engineer', company: 'at a product company',
  skills: ['✅ React', '✅ TypeScript', '✅ System Design', '⚡ AWS'],
} as const;
export const MATCHING_DEMO = {
  label: 'Job Match', freshLabel: 'Sample', detected: '🎯 Strong Match',
  jobTitle: 'Senior Frontend Engineer, Remote',
  matchLabel: 'Match Score: ', matchScore: '94%',
  tailorBtn: '⚡ Tailor Resume', coverBtn: '📋 Cover Letter',
} as const;
export const PROFILE_DEMO = {
  label: 'Public Profile', sample: 'Sample', name: 'Sarah Chen', role: 'Senior Frontend Engineer',
  place: 'Austin, TX', status: 'Open to work', chips: ['7+ years', '24 skills'],
  pdfBtn: 'Resume PDF', contactBtn: 'Contact Sarah',
} as const;


// ── How It Works ──
export const HOW_IT_WORKS = {
  chip: 'How It Works',
  title: 'Up and running in minutes',
} as const;
export const HOW_IT_WORKS_STEPS = [
  { step: '01', title: 'Upload your resume', desc: 'Drop in your existing resume or fill in your profile. Our AI instantly parses and structures your experience.', color: COLORS.PRIMARY },
  { step: '02', title: 'AI enhances your profile', desc: 'Get an AI-generated summary, extracted keywords, and actionable insights to make your profile stand out.', color: '#a78bfa' },
  { step: '03', title: 'Tailor & apply', desc: 'Tailor your resume to a specific job in one click, generate a matching cover letter, and track every application in one place.', color: COLORS.SUCCESS },
] as const;

// ── Candidates / Recruiters ──
export const AUDIENCE_SECTION = { chip: 'Two Sides, One Platform', title: 'Built for both sides of the table' } as const;
export const CANDIDATE = {
  title: 'For Candidates',
  desc: 'Build your AI-enhanced profile once, then tailor it to every job. Apply faster, interview smarter, negotiate better.',
  features: [
    'AI profile enhancement & keyword optimization', 'One-click resume tailoring for any job',
    'AI-matched job feed with ghost-job filtering', 'Agent Arena salary negotiation practice',
    'Skills gap analysis & learning plans', 'Application tracking dashboard',
  ],
  authBtn: 'Go to Profile', unauthBtn: 'Start as Candidate',
} as const;
export const RECRUITER = {
  title: 'For Recruiters', badge: 'Coming Soon',
  desc: 'Find the right candidates faster with AI-powered screening, smart matching, and automated interview scheduling.',
  features: [
    'AI-powered candidate screening & scoring', 'Smart matching with detailed fit analysis',
    'Bulk candidate import & management', 'Custom application form builder',
    'Interview scheduling & calendar', 'Phone screening with AI insights',
  ],
  comingSoon: 'Coming Soon',
} as const;

// ── More Features ──
export const MORE_FEATURES_SECTION = { chip: 'And So Much More', title: 'A complete career platform' } as const;
export const MORE_FEATURES_DATA = [
  { title: 'Community Feed', desc: 'Share wins, ask questions, and network with professionals.', color: COLORS.PRIMARY, link: '/feed' },
  { title: 'Career Insights', desc: 'AI-driven suggestions for your career trajectory.', color: COLORS.ACCENT_PINK, link: '/profile' },
  { title: 'Privacy First', desc: 'Control who sees your profile with granular settings.', color: '#64748b', link: '/privacy' },
] as const;

// ── Final CTA ──
export const FINAL_CTA = {
  titlePrefix: 'Ready to see ', titleHighlight: 'your tailored resume', titleSuffix: '?',
  subtitle: 'Start a conversation with Remi. You can build your whole profile before you create an account. Free to start, no credit card required.',
  primaryBtn: 'Build my profile, free', secondaryBtn: 'View Pricing',
} as const;

// ── Footer ──
export const FOOTER_DESC = 'The AI-powered career platform. Build your profile once, tailor it everywhere, and land your dream job faster.';
export const FOOTER_SOCIAL = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/profilleai' },
  { label: 'Twitter', href: 'https://twitter.com/profilleai' },
] as const;
export const FOOTER_COLUMNS = [
  { title: 'For Candidates', links: [{ label: 'Browse Jobs', to: '/jobs' }, { label: 'My Profile', to: '/profile' }, { label: 'Community Feed', to: '/feed' }, { label: 'Pricing', to: '/pricing' }] },
  { title: 'For Recruiters', links: [{ label: 'Coming Soon', to: '/register' }] },
  { title: 'Company', links: [{ label: 'Blog', to: '/blog' }, { label: 'Community Feed', to: '/feed' }, { label: 'Privacy Policy', to: '/privacy' }, { label: 'Terms of Service', to: '/terms' }, { label: 'Contact Us', href: 'mailto:support@profilleai.com' }] },
] as const;
export const FOOTER_BOTTOM_LINKS = [{ label: 'Privacy', to: '/privacy' }, { label: 'Terms', to: '/terms' }] as const;
