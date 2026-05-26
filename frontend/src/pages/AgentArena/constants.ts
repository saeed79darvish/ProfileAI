/* ================================================================
   AgentArena · mock data & shared constants
   No API calls live here, these mocks feed the four AgentArena
   prototype screens (Setup, Dashboard, Review, Training).
   ================================================================ */

import type {
  QueueApplication,
  ActivityItem,
  TrainingTopic,
  MemoryRow,
  StatCard,
} from './types';

export const MOBILE_BREAKPOINT = 768;

/* -------- kept for back-compat with existing utils.ts ---------- */
export const STATUS_MAP: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

// Dashboard + Review pages re-fetch on this cadence. useDashboardData
// refetches FOUR endpoints (stats, queue, activity, status) per tick,
// so at 10s that's 24 req/min from this page alone — enough on its own
// to brush the globalLimiter (600 / 15min ≈ 40 req/min) once other
// tabs (unread-count, /me, RUM) chime in. 30s is still well below the
// scout cadence (10min) and the external-jobs cron (15min), so the UI
// never lags reality by more than one tick.
export const POLLING_INTERVAL_MS = 30000;

/* ================================================================
   Dashboard stats
   ================================================================ */
export const MOCK_STATS: StatCard[] = [
  {
    key: 'queue',
    label: 'In queue',
    value: 7,
    change: 'All prepared · ready to review',
    icon: '⏳',
  },
  {
    key: 'applied',
    label: 'Applied this week',
    value: 23,
    change: '+4 vs last week',
    icon: '✓',
  },
  {
    key: 'replies',
    label: 'Replies',
    value: 3,
    change: '13% response rate',
    icon: '✉',
  },
  {
    key: 'interviews',
    label: 'Interviews',
    value: 1,
    change: 'Linear · Thu 3pm',
    icon: '★',
  },
];

/* ================================================================
   Review queue / dashboard table
   ================================================================ */
export const MOCK_QUEUE: QueueApplication[] = [
  {
    id: 'linear-staff-fe',
    company: 'Linear',
    companyKey: 'linear',
    logoText: 'L',
    role: 'Staff Frontend Engineer',
    location: 'Remote',
    salary: '$200–250k',
    match: 89,
    caughtAt: '38 min ago',
    prepared: { resume: true, cover: true, form: true },
    status: 'approved',
    postedAgo: '3 days ago',
  },
  {
    id: 'notion-senior-web',
    company: 'Notion',
    companyKey: 'notion',
    logoText: 'N',
    role: 'Senior Eng, Web',
    location: 'Remote',
    salary: '$170–210k',
    match: 80,
    caughtAt: '1h ago',
    prepared: { resume: true, cover: true, form: true },
    status: 'rejected',
    postedAgo: '5 days ago',
  },
  {
    id: 'stripe-senior-checkout',
    company: 'Stripe',
    companyKey: 'stripe',
    logoText: 'S',
    role: 'Senior Frontend Engineer, Checkout',
    location: 'Remote (US)',
    salary: '$180k – $230k',
    match: 92,
    caughtAt: '12 min ago',
    prepared: { resume: true, cover: true, form: true },
    status: 'pending',
    postedAgo: '2 days ago',
    skills: [
      { name: 'react', have: true },
      { name: 'typescript', have: true },
      { name: 'payments', have: true },
      { name: 'accessibility', have: true },
      { name: 'graphql', missing: true },
    ],
  },
  {
    id: 'figma-senior-product',
    company: 'Figma',
    companyKey: 'figma',
    logoText: 'F',
    role: 'Senior Product Engineer',
    location: 'SF/Remote',
    salary: '$190–240k',
    match: 85,
    caughtAt: '1h ago',
    prepared: { resume: true, cover: true, form: true },
    status: 'pending',
    postedAgo: '4 days ago',
  },
  {
    id: 'vercel-staff-dx',
    company: 'Vercel',
    companyKey: 'vercel',
    logoText: 'V',
    role: 'Staff Engineer, DX',
    location: 'Remote',
    salary: '$210–260k',
    match: 82,
    caughtAt: '2h ago',
    prepared: { resume: true, cover: true, form: true },
    status: 'pending',
    postedAgo: '1 day ago',
  },
  {
    id: 'shopify-senior-fe',
    company: 'Shopify',
    companyKey: 'shopify',
    logoText: 'S',
    role: 'Senior Frontend Dev',
    location: 'Remote',
    salary: '$155–195k',
    match: 74,
    caughtAt: '4h ago',
    prepared: { resume: true, cover: true, form: true },
    status: 'pending',
    postedAgo: '6 days ago',
  },
  {
    id: 'openai-frontend-platform',
    company: 'OpenAI',
    companyKey: 'openai',
    logoText: 'O',
    role: 'Frontend Engineer, Platform',
    location: 'SF',
    salary: '$200–260k',
    match: 88,
    caughtAt: '6h ago',
    prepared: { resume: true, cover: false, form: true },
    status: 'pending',
    postedAgo: '1 day ago',
  },
];

/* ================================================================
   Live activity timeline (dashboard)
   ================================================================ */
export const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: 'a1',
    title: 'Tailoring resume for OpenAI',
    sub: 'Frontend Engineer, Platform · adjusting for "design systems"',
    time: 'Just now',
    live: true,
  },
  {
    id: 'a2',
    title: 'Prepared Stripe application',
    sub: 'Resume, cover letter, 14 form fields ready',
    time: '12 min ago',
  },
  {
    id: 'a3',
    title: 'New matches found',
    sub: '3 new jobs matching your criteria',
    time: '28 min ago',
  },
  {
    id: 'a4',
    title: 'Sent application to Linear',
    sub: 'Staff Frontend · you approved 2h ago',
    time: '2h ago',
  },
  {
    id: 'a5',
    title: 'Reply from Stripe',
    sub: '"Thanks for applying, we\'d like a call"',
    time: 'Yesterday',
  },
  {
    id: 'a6',
    title: 'Skipped Meta',
    sub: 'Blocked by your safety rails',
    time: '2 days ago',
  },
];

/* ================================================================
   Training page · coverage topics
   ================================================================ */
export const MOCK_TRAINING_TOPICS: TrainingTopic[] = [
  {
    key: 'motive',
    name: 'Motivations & fit',
    sub: '4 of 4 covered',
    pct: 100,
    variant: 'good',
    icon: '✦',
  },
  {
    key: 'stories',
    name: 'Stories (STAR)',
    sub: '3 of 6 · add 3 more',
    pct: 50,
    variant: 'warn',
    icon: '★',
  },
  {
    key: 'values',
    name: 'Values & opinions',
    sub: '4 of 5 covered',
    pct: 80,
    variant: 'good',
    icon: '♥',
  },
  {
    key: 'limits',
    name: 'Limits & boundaries',
    sub: '3 of 3 covered',
    pct: 100,
    variant: 'good',
    icon: '⊘',
  },
  {
    key: 'voice',
    name: 'Voice sample',
    sub: '1 of 2 · one more prompt',
    pct: 50,
    variant: 'warn',
    icon: '¶',
  },
];

/* ================================================================
   Training page · memory preview rows
   ================================================================ */
export const MOCK_MEMORY: MemoryRow[] = [
  {
    key: 'Motivation',
    value:
      '"Drawn to high-stakes consumer products where 1% improvements compound to $M impact."',
  },
  {
    key: 'Dealbreaker',
    value: 'Ad-tech, crypto, roles requiring < 2 days on-site in EU timezone.',
  },
  {
    key: 'Leadership',
    value:
      '"Data-first pushback. Push once, document the risk, defer to owner after that."',
  },
  {
    key: 'Story · $40M/day',
    value:
      'Booking checkout redesign, 11% conversion lift, gated 2-week A/B rollout.',
  },
  {
    key: 'Tone',
    value:
      'Direct, specific numbers where possible, light humor. Avoids corporate filler.',
  },
];

/* ================================================================
   Review diff mock
   ================================================================ */
export const MOCK_DIFF = {
  summary: {
    old: 'Senior frontend engineer with 8+ years building consumer products in React and TypeScript.',
    new: 'Senior frontend engineer with 8+ years building <b>payment experiences</b> and consumer products in React and TypeScript. Shipped <b>checkout flows serving millions of users</b>, led design-system work for 30+ locales.',
  },
  experience: [
    {
      old: 'Led checkout redesign, improving conversion',
      new: 'Led checkout redesign processing <b>$40M/day</b>, increasing conversion by <b>11%</b>',
    },
  ],
  added: [
    'NEW · Shipped A/B framework powering 200+ concurrent experiments on payment UI',
  ],
  newSkills: ['+ graphql', '+ payments'],
};

/* ================================================================
   Training chat mock
   ================================================================ */
export const MOCK_CHAT_MESSAGES: {
  id: string;
  role: 'ai' | 'me';
  topic?: string;
  content: string;
}[] = [
  {
    id: 'm1',
    role: 'ai',
    topic: 'Motivations · complete',
    content:
      "Got it, so: payments, consumer scale, companies where 1% lifts compound to real $. I'll use this verbatim on \"why us?\" questions. On to <b>stories</b>.",
  },
  {
    id: 'm2',
    role: 'ai',
    topic: 'Stories · 3 of 6',
    content:
      'Tell me about a time you had to push back on a PM or leader. What was the call, and what happened after?',
  },
  {
    id: 'm3',
    role: 'me',
    content:
      "At Booking, our PM wanted to ship the new checkout without A/B-ing it. I pushed for a 2-week gated rollout, she didn't love the delay, but we caught a 3% drop-off that would've cost ~$1.2M/day. Earned trust. Next launch she came to me first.",
  },
  {
    id: 'm4',
    role: 'ai',
    content:
      'Solid. Two quick follow-ups so I can quote this well in future apps —<br/><br/><b>(1)</b> How did you frame the ask to her, data, risk, or gut?<br/><b>(2)</b> Would you describe yourself as someone who pushes back <i>often</i>, or only on big calls?',
  },
];

export const MOCK_QUICK_REPLIES = [
  'Data-first',
  'Risk-framed',
  'Gut call',
  'Mix of all three',
  'Only on big calls',
  "Often, it's part of my craft",
];
