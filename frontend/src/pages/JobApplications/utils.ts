// Utils for JobApplications
import { CUSTOM_LABELS } from './constants';

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getInitials = (firstName?: string, lastName?: string): string => {
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
};

export const parseAnswers = (answers: unknown): Record<string, unknown> | null => {
  if (!answers) return null;

  let parsed = answers;
  if (typeof answers === 'string') {
    try {
      parsed = JSON.parse(answers);
    } catch {
      return null;
    }
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const flattened: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (value === '' || value === null || value === undefined) continue;

    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      const isNestedAnswers = Object.values(value as Record<string, unknown>).some(v =>
        typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number'
      );
      if (isNestedAnswers) {
        for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
          if (nestedValue !== '' && nestedValue !== null && nestedValue !== undefined) {
            flattened[nestedKey] = nestedValue;
          }
        }
      } else {
        flattened[key] = value;
      }
    } else {
      flattened[key] = value;
    }
  }

  return Object.keys(flattened).length > 0 ? flattened : null;
};

export const parseAiAnalysis = (analysis: unknown): Record<string, unknown> | null => {
  if (!analysis) return null;
  if (typeof analysis === 'string') {
    try {
      return JSON.parse(analysis);
    } catch {
      return null;
    }
  }
  return analysis as Record<string, unknown>;
};

export const formatQuestionLabel = (key: string): string => {
  if (!key) return '';

  if (CUSTOM_LABELS[key]) return CUSTOM_LABELS[key];

  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

export const renderAnswerValue = (answer: unknown): string => {
  if (answer === null || answer === undefined) return 'Not provided';
  if (answer === true) return 'Yes';
  if (answer === false) return 'No';
  if (Array.isArray(answer)) return answer.join(', ') || 'None';
  if (typeof answer === 'object') {
    if ((answer as Record<string, unknown>).value !== undefined) return String((answer as Record<string, unknown>).value);
    try {
      return JSON.stringify(answer);
    } catch {
      return 'Complex value';
    }
  }
  return String(answer);
};
