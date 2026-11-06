/** Shapes shared with the backend (see the answer memory contract). */

export type FactType = 'choice' | 'yesno' | 'text';

export interface FactChoice {
  value: string;
  label: string;
}

export interface CatalogFact {
  id: string;
  label: string;
  ask: string;
  type: FactType;
  choices?: FactChoice[];
  /** Regex sources, matched case-insensitively against the form question. */
  detect: string[];
}

export interface CatalogStory {
  id: string;
  label: string;
  ask: string;
}

export interface AnswerCatalog {
  facts: CatalogFact[];
  stories: CatalogStory[];
}

export interface NeedsFact {
  id: string;
  label: string;
  ask: string;
  type: FactType;
  choices?: FactChoice[];
}

export type DetailSource = 'fact' | 'story' | 'profile' | 'ai' | 'needs_you' | 'learned';

export interface AnswerDetail {
  answer: string;
  source: DetailSource;
  factId?: string;
  choiceValue?: string;
  needsFact?: NeedsFact;
  wordCount?: number;
  /** source 'learned': the stored item this answer came from. */
  learnedId?: string;
  learnedFrom?: LearnedFrom;
  /** source 'needs_you': a stored answer that did not map to the form's options. */
  suggestion?: string;
}

/** Where a learned answer was first given. */
export interface LearnedFrom {
  question: string;
  company?: string;
  at?: string;
}

/** One remembered answer, as the server returns it. */
export interface LearnedItem {
  id: string;
  question: string;
  key?: string;
  kind: 'choice' | 'text';
  answer: string;
  options?: string[];
  factId?: string;
  choiceValue?: string;
  company?: string;
  jobTitle?: string;
  source?: 'user';
  uses?: number;
  createdAt?: string;
  updatedAt?: string;
  lastUsedAt?: string;
}

export interface WordHint {
  /** 0 means the form states no minimum. */
  min: number;
  /** 0 means the form states no maximum. */
  max: number;
}
