export const ROUTES = {
  REGISTER: '/register',
} as const;

export const TEXT = {
  PROMO_BUTTON: 'Have a Promo Code?',
  LAUNCH_BADGE: 'Launch Pricing \u2014 Lock in These Rates',
  TITLE: 'Simple, Transparent Pricing',
  SUBTITLE: 'Start free with a 3-resume trial. Upgrade to Pro for serious job seekers, or Pro+ for hands-off auto-apply. Application credits never expire.',
  MONTHLY: 'Monthly',
  ANNUAL: 'Annual',
  SAVE_BADGE: 'Save 34%',
  POPULAR: 'Most Popular',
  CREDIT_PACKS_TITLE: 'Application Credit Packs',
  CREDIT_PACKS_SUBTITLE: 'Need more applications without subscribing? Each credit = 1 tailored resume + 1 cover letter. Credits never expire.',
  BEST_VALUE: 'Best Value',
  PROCESSING: 'Processing...',
  BUY_NOW: 'Buy Now',
  COMPARE_TITLE: 'Compare Plans',
  COL_FEATURES: 'Features',
  COL_FREE: 'Free',
  COL_PRO: 'Pro',
  COL_PRO_PLUS: 'Pro+',
  FAQ_TITLE: 'Frequently Asked Questions',
  CTA_TITLE: 'Ready to supercharge your job search?',
  CTA_SUBTITLE: 'Start free, upgrade anytime. No credit card required.',
  CTA_FREE: 'Get Started Free',
  CTA_SUPPORT: 'Contact Support',
  DIALOG_TITLE: 'Promo Code',
  DIALOG_CLOSE: 'Close',
  SNACKBAR_PACK_SUCCESS: 'Credit pack purchased successfully!',
  SNACKBAR_CANCELLED: 'Purchase cancelled.',
  SNACKBAR_FREE_TIER: 'You already have access to the free tier!',
  SNACKBAR_CREDITS_ADDED: 'Credits added to your account!',
  SNACKBAR_FAILED: 'Failed to purchase. Please try again.',
  SNACKBAR_SUBSCRIBED: 'Successfully subscribed! Redirecting...',
  CONTACT_EMAIL: 'support@profileai.com',
} as const;

// Application credit packs — only sell repeat-use credits (tailor + cover letter
// bundled 1:1, since users always need both per job application). Parse and
// profile_enhance are one-shot — when free users hit the cap we direct them
// to upgrade to Pro instead.
export const CREDIT_PACKS = [
  { id: 'apply_10', name: 'Apply 10', description: '10 tailored resumes + 10 cover letters', price: 6.99, perCredit: '$0.70 / app', popular: false },
  { id: 'apply_25', name: 'Apply 25', description: '25 tailored resumes + 25 cover letters', price: 13.99, perCredit: '$0.56 / app', popular: true },
  { id: 'apply_60', name: 'Apply 60', description: '60 tailored resumes + 60 cover letters', price: 24.99, perCredit: '$0.42 / app', popular: false },
] as const;

export const COMPARE_FEATURES = [
  { name: 'Resume Parsing',         free: '1/month',   pro: '20/month',  proPlus: '50/month' },
  { name: 'Profile Enhancement',    free: '1/month',   pro: '30/month',  proPlus: '100/month' },
  { name: 'Resume Tailoring',       free: '3 lifetime', pro: '50/month', proPlus: '200/month' },
  { name: 'AI Cover Letter',        free: '2/month',   pro: '30/month',  proPlus: '200/month' },
  { name: 'Career Suggestions',     free: '5/month',   pro: 'Unlimited', proPlus: 'Unlimited' },
  { name: 'ApplyPilot Auto-Apply',  free: false,        pro: false,      proPlus: '30/week' },
  { name: 'Interview Prep',         free: false,        pro: true,       proPlus: 'Unlimited' },
  { name: 'Watermark-free Exports', free: false,        pro: true,       proPlus: true },
  { name: 'Advanced Analytics',     free: false,        pro: true,       proPlus: true },
  { name: 'Priority Support',       free: false,        pro: true,       proPlus: true },
] as const;

export const FAQS = [
  { question: 'How does the Free plan work?', answer: 'Free includes 3 lifetime resume tailorings, 1 resume parse and 1 profile enhancement per month, and 2 cover letters per month. It\'s designed as a trial — once you\'ve used your 3 tailorings, upgrade to Pro or buy an Apply credit pack to keep going.' },
  { question: 'What\'s the difference between Pro and Pro+?', answer: 'Pro ($14.99/mo) gives you 50 tailored resumes and 30 cover letters per month — plenty for an active job search. Pro+ ($29.99/mo) adds ApplyPilot auto-apply (up to 30 applications per week, fully automated), batch tailoring, and unlimited interview prep.' },
  { question: 'What are Application Credit Packs?', answer: 'One-time purchases that give you extra application credits (1 tailored resume + 1 cover letter each). Credits never expire and are used automatically when your subscription limits are reached. Useful if you\'re between jobs but don\'t want a recurring plan.' },
  { question: 'Should I buy a credit pack or subscribe?', answer: 'For most users, Pro is the better value: Apply 25 costs $13.99 for 25 applications, while Pro is $14.99/mo for up to 50 — plus everything else. Packs make sense if you\'re only applying occasionally or want to top up an existing subscription.' },
  { question: 'Can I change plans later?', answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.' },
  { question: 'What payment methods do you accept?', answer: 'We accept all major credit cards via Stripe, plus PayPal.' },
  { question: 'Can I cancel my subscription anytime?', answer: 'Absolutely — cancel any time, no penalties. Any credit pack credits stay on your account even after cancellation.' },
] as const;

export const TIMINGS = {
  SNACKBAR_MS: 3000,
  SNACKBAR_LONG_MS: 4000,
  RELOAD_DELAY_MS: 2000,
} as const;

