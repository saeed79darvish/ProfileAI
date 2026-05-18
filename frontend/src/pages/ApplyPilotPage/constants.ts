import { COLORS, GRADIENTS } from '../../designTokens';

export const tokens = {
  primary: COLORS.PRIMARY,
  secondary: COLORS.PRIMARY_DARK,
  pageBg: '#f5f7fa',
  cardBg: COLORS.BG_WHITE,
  border: COLORS.BORDER_LIGHT,
  textPrimary: COLORS.TEXT_PRIMARY,
  textSecondary: COLORS.TEXT_SECONDARY,
  textMuted: COLORS.TEXT_MUTED,
  surfaceAlt: '#f9fafb',
  gradient: GRADIENTS.PRIMARY,
  gradientText: 'linear-gradient(135deg, #667eea 30%, #a78bfa 60%, #764ba2 100%)',
};

export const features = [
  {
    id: 'autofill',
    title: 'Auto-fill applications in 1 click',
    description:
      'Stop re-entering the same information on every job application. ApplyPilot auto-fills your details from your ProfileAI profile, name, experience, education, skills, so you can focus on what actually matters.',
    cta: 'Start applying faster',
    ctaLink: '/register',
    visual: 'autofill',
  },
  {
    id: 'tailor',
    title: 'AI-tailored resumes for every job',
    description:
      'Get an instant match score, see your strong matches and skill gaps, then download a resume tailored specifically for each position. Choose your tone, section lengths, and emphasis areas, all in one click.',
    cta: 'Tailor your resume',
    ctaLink: '/register',
    visual: 'tailor',
  },
  {
    id: 'cover-letter',
    title: 'Generate cover letters that sound like you',
    description:
      'Pick your tone, Professional, Conversational, or Enthusiastic, choose a length, and let AI craft a personalized cover letter for each job. No more staring at blank pages or copy-pasting templates.',
    cta: 'Write smarter cover letters',
    ctaLink: '/register',
    visual: 'cover-letter',
  },
  {
    id: 'job-analysis',
    title: 'Analyze any job posting instantly',
    description:
      "See exactly how your profile stacks up against any job. Get a keyword match score, identify what's already in your profile, and discover missing keywords, so you know exactly what to improve before applying.",
    cta: 'Analyze your match',
    ctaLink: '/register',
    visual: 'job-analysis',
  },
  {
    id: 'tailor-settings',
    title: 'Fine-tune every detail of your resume',
    description:
      'Choose your resume tone, Concise, Professional, or Detailed, adjust section lengths with sliders, pick which sections to include, and control emphasis areas. Full creative control, zero guesswork.',
    cta: 'Customize your resume',
    ctaLink: '/register',
    visual: 'tailor-settings',
  },
  {
    id: 'resume-download',
    title: 'Download in PDF or Word, ready to send',
    description:
      'Preview your tailored resume, pick PDF or Word format, and download with a single click. The filename is auto-generated to match the job title so your files stay organized.',
    cta: 'Download your resume',
    ctaLink: '/register',
    visual: 'resume-download',
  },
];

export const testimonials = [
  {
    name: 'Priya M.',
    role: 'Software Engineer at Google',
    text: 'ApplyPilot saved me at least 40 hours during my job search. The auto-tailor feature is a game changer.',
  },
  {
    name: 'James K.',
    role: 'Product Manager at Stripe',
    text: 'I went from 5% callback rate to 30% after using the resume tailoring. The AI actually understands job descriptions.',
  },
  {
    name: 'Sarah L.',
    role: 'UX Designer at Figma',
    text: 'The 1-click apply is incredible. I applied to 50 jobs in the time it used to take me to do 5.',
  },
  {
    name: 'Marcus D.',
    role: 'Data Scientist at Netflix',
    text: "Finally a tool that doesn't just fill in forms, it actually writes personalized cover letters that sound like me.",
  },
];

export const platforms = [
  'LinkedIn', 'Greenhouse', 'Lever', 'Workday', 'Ashby',
  'BambooHR', 'iCIMS', 'Taleo', 'SmartRecruiters', 'JazzHR', '+50 more',
];

export const fields = [
  { label: 'First Name', value: 'Sarah' },
  { label: 'Last Name', value: 'Chen' },
  { label: 'Email', value: 'sarah.chen@email.com' },
  { label: 'Phone', value: '(555) 123-4567' },
  { label: 'Resume/CV', value: 'SarahChen_Resume.pdf' },
];

export const missingKeywords = [
  'typescript', 'react', 'aws', 'rest', 'api', 'ux', 'ui', 'frontend', 'backend', 'security',
];

export const strongMatches = [
  '8+ years React/TypeScript', 'High-performance UI dev', 'Component architecture', 'State management',
];

export const gaps = [
  { label: 'Electron desktop dev', color: COLORS.ERROR },
  { label: 'IDE extension dev', color: COLORS.WARNING },
  { label: 'Agent interaction design', color: COLORS.ERROR },
  { label: 'Motion design', color: COLORS.WARNING },
];
