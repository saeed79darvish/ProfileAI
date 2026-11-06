import type { AnswerDetail, DetailSource } from './types';

export type CardState = 'ready' | 'needs_you' | 'ai' | 'skipped';

export interface CardInput {
  detail?: AnswerDetail | null;
  answer: string;
  /** The person edited the text, so it is theirs now. */
  edited?: boolean;
  /** The form field is optional. */
  optional?: boolean;
  /** Re-used from an earlier run, not just generated. */
  cached?: boolean;
  loading?: boolean;
  done?: boolean;
}

export function deriveCardState(c: CardInput): CardState {
  const hasAnswer = !!(c.answer && c.answer.trim());
  if (!hasAnswer) {
    return c.optional && !c.detail?.needsFact ? 'skipped' : 'needs_you';
  }
  if (c.edited) return 'ready';
  const source: DetailSource = c.detail?.source || 'ai';
  if (source === 'needs_you') return 'needs_you';
  if (source === 'ai') return 'ai';
  return 'ready';
}

export function stateLabel(state: CardState): string {
  switch (state) {
    case 'ready': return 'Ready';
    case 'needs_you': return 'Needs you';
    case 'ai': return 'Written by AI';
    default: return 'Optional';
  }
}

export function sourceLine(detail: AnswerDetail | null | undefined, cached?: boolean, edited?: boolean): string {
  if (edited) return 'Edited by you';
  if (cached) return 'Saved for this job';
  switch (detail?.source) {
    case 'profile': return 'From your profile';
    case 'learned': return 'From your earlier answer';
    case 'fact':
    case 'story': return 'From what you told us';
    case 'needs_you': return detail.needsFact ? 'We do not have this yet' : 'Only you can answer this one';
    default: return 'Drafted from your profile and this job';
  }
}

export interface Progress {
  ready: number;
  total: number;
  done: number;
  needsYou: number;
}

/** Optional blanks are left out of the total so "9 of 9 ready" is reachable. */
export function progressOf(cards: Array<{ state: CardState; done?: boolean; loading?: boolean }>): Progress {
  let ready = 0, total = 0, done = 0, needsYou = 0;
  for (const c of cards) {
    if (c.state === 'skipped') continue;
    total++;
    if (c.done) done++;
    if (c.loading) continue;
    if (c.state === 'needs_you') needsYou++;
    else ready++;
  }
  return { ready, total, done, needsYou };
}

export function progressLabel(p: Progress): string {
  return `${p.ready} of ${p.total} ready`;
}
