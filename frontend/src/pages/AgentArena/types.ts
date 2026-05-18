/* ================================================================
   AgentArena · types
   These describe the shapes of the mock data used across the four
   AgentArena screens (Setup, Dashboard, Review, Training).
   ================================================================ */

export type CompanyKey =
  | 'stripe'
  | 'linear'
  | 'figma'
  | 'vercel'
  | 'shopify'
  | 'notion'
  | 'openai'
  | 'meta'
  | 'generic';

export interface QueueApplication {
  id: string;
  company: string;
  companyKey: CompanyKey;
  logoText: string;
  role: string;
  location: string;
  salary: string;
  match: number;
  caughtAt: string;
  prepared: { resume: boolean; cover: boolean; form: boolean };
  /** Used on the Review page only */
  status?: 'pending' | 'approved' | 'rejected';
  skills?: { name: string; have?: boolean; missing?: boolean }[];
  postedAgo?: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  sub: string;
  time: string;
  live?: boolean;
}

export type TopicKey = 'motive' | 'stories' | 'values' | 'limits' | 'voice';

export interface TrainingTopic {
  key: TopicKey;
  name: string;
  sub: string;
  pct: number;
  /** Visual fill style for the progress track */
  variant: 'good' | 'warn' | 'brand';
  icon: string;
}

export interface MemoryRow {
  key: string;
  value: string;
}

export type StatKey = 'queue' | 'applied' | 'replies' | 'interviews';

export interface StatCard {
  key: StatKey;
  label: string;
  value: string | number;
  change: string;
  /** Single-character/emoji glyph used in the colored chip */
  icon: string;
}
