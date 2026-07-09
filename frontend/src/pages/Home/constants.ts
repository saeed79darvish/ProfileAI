// Constants for Home
import { COLORS, GRADIENTS, RADIUS } from '../../designTokens';

export const ROUTES = {
  REGISTER: '/register',
  BROWSE: '/browse',
  RECRUITER_DASHBOARD: '/recruiter/dashboard',
  PROFILE: '/profile',
  APPLY_PILOT: '/applypilot',
  FEED: '/feed',
  PRICING: '/pricing',
  PRIVACY: '/privacy',
  TERMS: '/terms',
} as const;

export const STATS = {
  PROFILES: 12500,
  MATCHES: 8400,
  APPLICATIONS: 45000,
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
export const HERO_CHIP_LABEL = 'AI-Powered Career Platform';
export const HERO_TITLE_PARTS = { prefix: 'Your career, ', highlight: 'supercharged', suffix: ' by AI' } as const;
export const HERO_SUBTITLE = 'Tailor resumes in seconds, practice negotiation with AI agents, and land interviews faster, all powered by your single ProfilleAI profile.';

export const HERO_BUTTONS = {
  GET_STARTED: 'Get Started Free',
  BROWSE_JOBS: 'Browse Jobs',
  MY_DASHBOARD: 'My Dashboard',
  FIND_TALENT: 'Find Talent',
  MY_PROFILE: 'My Profile',
} as const;

export const TRUST_INDICATORS = [
  { text: 'Free to start' },
  { text: 'AI-powered' },
  { text: 'No credit card' },
] as const;

// ── Hero Visual Demo Cards ──
export const HERO_PROFILE_CARD = {
  name: 'Sarah Chen',
  role: 'Senior Engineer',
  skills: ['React', 'TypeScript'],
} as const;

export const HERO_AI_INSIGHT = { label: 'AI Insight', text: '"…would increase match by 15%"' } as const;

export const HERO_JOB_CARD = {
  label: '🚀 Job Detected',
  time: 'Just now',
  title: 'Staff Engineer',
  company: 'Vercel • Remote, US',
  skills: ['React', 'Next.js', 'TypeScript'],
  matchScore: '94%',
  matchLabel: 'Match Score',
} as const;

export const HERO_STATS_MINI = [
  { n: '12', label: 'APPLICATIONS', color: COLORS.PRIMARY },
  { n: '4', label: 'INTERVIEWS', color: COLORS.SUCCESS },
  { n: '2', label: 'OFFERS', color: COLORS.WARNING },
] as const;

// ── Stats Bar ──
export const STATS_LABELS = { PROFILES: 'Profiles Created', MATCHES: 'Jobs Matched', APPLICATIONS: 'Applications Sent' } as const;
export const COMPANY_NAMES = ['Google', 'Amazon', 'Meta', 'Microsoft', 'Apple', 'Netflix'] as const;
export const COMPANIES_LABEL = 'Candidates hired at';

// ── Feature Tabs ──
export const FEATURE_SECTION = {
  chip: 'Platform Features',
  titlePrefix: 'Everything you need to ',
  titleHighlight: 'land your dream job',
  subtitle: 'From tailoring your resume to practicing negotiations, one platform for your entire job search.',
  tryFree: 'Try it free',
} as const;

export const FEATURE_TABS_DATA = [
  {
    id: 'tailor', label: 'AI Tailoring',
    headline: 'Tailor your resume to any job in seconds',
    description: 'Our AI analyzes job descriptions and restructures your profile to highlight the most relevant skills, experience, and keywords, dramatically increasing your match score.',
    bullets: ['Match score analysis with gap detection', 'Smart keyword optimization', 'Skills gap learning plan', 'Download as PDF or Word'],
    color: COLORS.PRIMARY,
  },
  {
    id: 'extension', label: 'ApplyPilot',
    headline: 'Your AI co-pilot for job applications',
    description: 'ApplyPilot, our Chrome extension, detects job listings on LinkedIn, Greenhouse, Lever, and 20+ platforms. One click to tailor your resume and auto-fill applications, like having a career coach on every tab.',
    bullets: ['Works on LinkedIn, Greenhouse, Lever, Workday & more', 'One-click resume tailoring', 'Auto-fill job applications', 'Gap analysis before you apply'],
    color: '#a78bfa',
  },
] as const;

// Feature tab demo data
export const TAILOR_DEMO = {
  label: 'Tailored Result', score: '92%', role: 'Senior Frontend Engineer', company: 'at Google',
  skills: ['✅ React', '✅ TypeScript', '✅ System Design', '⚡ AWS'],
} as const;
export const EXTENSION_DEMO = {
  label: 'ApplyPilot', activeLabel: 'Active', detected: '🎯 Job Detected',
  jobTitle: 'Senior Engineer at Stripe',
  matchLabel: 'Match Score: ', matchScore: '94%',
  tailorBtn: '⚡ Tailor Resume', autoFillBtn: '📝 Auto-fill',
} as const;
export const ARENA_DEMO = {
  label: 'Agent Arena',
  recruiterLabel: 'AI Recruiter', recruiterMsg: '"Based on your 5 years of experience, what salary range are you targeting?"',
  userLabel: 'You', userMsg: '"I\'m looking at $160-180K, aligned with market rates for senior roles..."',
} as const;


// ── How It Works ──
export const HOW_IT_WORKS = {
  chip: 'How It Works',
  title: 'Up and running in minutes',
} as const;
export const HOW_IT_WORKS_STEPS = [
  { step: '01', title: 'Upload your resume', desc: 'Drop in your existing resume or fill in your profile. Our AI instantly parses and structures your experience.', color: COLORS.PRIMARY },
  { step: '02', title: 'AI enhances your profile', desc: 'Get an AI-generated summary, extracted keywords, and actionable insights to make your profile stand out.', color: '#a78bfa' },
  { step: '03', title: 'Tailor & apply anywhere', desc: 'Tailor your resume to specific jobs in one click. Use ApplyPilot to apply directly from any job board.', color: COLORS.SUCCESS },
] as const;

// ── Candidates / Recruiters ──
export const AUDIENCE_SECTION = { chip: 'Two Sides, One Platform', title: 'Built for both sides of the table' } as const;
export const CANDIDATE = {
  title: 'For Candidates',
  desc: 'Build your AI-enhanced profile once, then tailor it to every job. Apply faster, interview smarter, negotiate better.',
  features: [
    'AI profile enhancement & keyword optimization', 'One-click resume tailoring for any job',
    'ApplyPilot Chrome extension for any job board', 'Agent Arena salary negotiation practice',
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

// ── ApplyPilot CTA ──
export const APPLYPILOT_CTA = {
  brandTitle: 'ApplyPilot', brandSub: 'Chrome Extension',
  headingPrefix: 'Your AI co-pilot for ', headingHighlight: 'every job application',
  desc: 'ApplyPilot lives in your browser, detects job listings on 20+ platforms, and gives you AI-powered tools right where you need them.',
  primaryBtn: 'Add to Chrome', secondaryBtn: 'Learn More',
} as const;
export const APPLYPILOT_BULLETS = [
  { icon: '🎯', text: 'Auto-detects jobs on LinkedIn, Greenhouse, Lever & more' },
  { icon: '⚡', text: 'One-click resume tailoring with match score' },
  { icon: '📝', text: 'Smart auto-fill for application forms' },
  { icon: '🔍', text: 'Gap analysis before you hit apply' },
] as const;
export const PLATFORM_CHIPS = ['LinkedIn', 'Greenhouse', 'Lever', 'Workday', 'Ashby', '+20 more'] as const;

// Browser mockup demo
export const BROWSER_DEMO = {
  url: 'linkedin.com/jobs/senior-engineer-stripe',
  jobLabel: 'LINKEDIN JOB POSTING', jobTitle: 'Senior Frontend Engineer',
  jobCompany: 'Stripe · San Francisco, CA · $180-220K',
  matchLabel: 'Your Match Score', matchScore: '94%',
  skills: ['✅ React', '✅ TypeScript', '✅ System Design', '⚡ AWS'],
  tailorBtn: '⚡ Tailor & Apply', coverBtn: '📋 Cover Letter',
  floatingNote: '✨ Works on 20+ job boards',
  detectedLabel: 'Job Detected',
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
  titlePrefix: 'Ready to ', titleHighlight: 'supercharge', titleSuffix: ' your career?',
  subtitle: 'Join thousands of professionals using AI to land better jobs faster. Free to start, no credit card required.',
  primaryBtn: 'Get Started Free', secondaryBtn: 'View Pricing',
  rating: 'Loved by 12,500+ professionals worldwide',
} as const;

// ── Footer ──
export const FOOTER_DESC = 'The AI-powered career platform. Build your profile once, tailor it everywhere, and land your dream job faster.';
export const FOOTER_SOCIAL = ['LinkedIn', 'Twitter'] as const;
export const FOOTER_COLUMNS = [
  { title: 'For Candidates', links: [{ label: 'My Profile', to: '/profile' }, { label: 'Community Feed', to: '/feed' }, { label: 'Network', to: '/network' }, { label: 'Pricing', to: '/pricing' }] },
  { title: 'For Recruiters', links: [{ label: 'Coming Soon', to: '/register' }] },
  { title: 'Company', links: [{ label: 'Blog', to: '/blog' }, { label: 'Community Feed', to: '/feed' }, { label: 'Privacy Policy', to: '/privacy' }, { label: 'Terms of Service', to: '/terms' }, { label: 'Contact Us', href: 'mailto:support@profileai.com' }] },
] as const;
export const FOOTER_BOTTOM_LINKS = [{ label: 'Privacy', to: '/privacy' }, { label: 'Terms', to: '/terms' }] as const;
