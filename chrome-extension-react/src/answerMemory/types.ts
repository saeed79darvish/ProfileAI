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

export type DetailSource = 'fact' | 'story' | 'profile' | 'ai' | 'needs_you';

export interface AnswerDetail {
  answer: string;
  source: DetailSource;
  factId?: string;
  choiceValue?: string;
  needsFact?: NeedsFact;
  wordCount?: number;
}

export interface WordHint {
  /** 0 means the form states no minimum. */
  min: number;
  /** 0 means the form states no maximum. */
  max: number;
}
