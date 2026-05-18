// Utils for JobDetail
import * as React from 'react';

// Common section header patterns
const sectionPatterns = [
  /^about\s+(the\s+)?(role|position|opportunity)/i,
  /^what\s+you('ll|'ll|\s+will)\s+(do|be\s+doing)/i,
  /^(key\s+)?responsibilities/i,
  /^what\s+we('re|'re|\s+are)\s+looking\s+for/i,
  /^requirements?/i,
  /^qualifications?/i,
  /^nice\s+to\s+have/i,
  /^preferred\s+(qualifications?|skills?)/i,
  /^why\s+(join\s+us|work\s+(here|with\s+us))/i,
  /^benefits?\s*(&|and)?\s*perks?/i,
  /^(what\s+we\s+offer|our\s+offer)/i,
  /^education\s*(&|and)?\s*experience/i,
  /^technical\s+skills?/i,
  /^soft\s+skills?/i,
  /^certifications?/i,
  /^health\s*(&|and)?\s*wellness/i,
  /^work[\s-]life\s+balance/i,
  /^growth\s*(&|and)?\s*development/i,
  /^compensation\s*(&|and)?\s*perks?/i,
  /^culture\s*(&|and)?\s*fun/i,
  /^team\s*(&|and)?\s*culture/i,
];

/**
 * Render formatted job content - detects clean text structure
 * and converts it to React elements with appropriate styling.
 */
export const renderFormattedContent = (text: string | null | undefined): React.ReactNode => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let key = 0;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        React.createElement('ul', { key: key++, className: 'bullet-list' },
          currentList.map((item, idx) =>
            React.createElement('li', { key: idx, className: 'bullet-item' }, item)
          )
        )
      );
      currentList = [];
    }
  };

  const isSectionHeader = (line: string) => {
    const cleaned = line.replace(/[*#:]/g, '').trim();
    return sectionPatterns.some(pattern => pattern.test(cleaned));
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    const cleanLine = trimmed.replace(/^\*\*|\*\*$/g, '').replace(/^#+\s*/, '');

    if (isSectionHeader(cleanLine)) {
      flushList();
      elements.push(
        React.createElement('div', { key: key++, className: 'section-header' }, cleanLine)
      );
      continue;
    }

    if (/^[-\*•]\s/.test(trimmed)) {
      currentList.push(trimmed.replace(/^[-\*•]\s*/, ''));
      continue;
    }

    if (/^\d+[\.\)]\s/.test(trimmed)) {
      currentList.push(trimmed.replace(/^\d+[\.\)]\s*/, ''));
      continue;
    }

    flushList();
    elements.push(
      React.createElement('p', { key: key++, className: 'paragraph' }, cleanLine)
    );
  }

  flushList();

  return elements.length > 0 ? elements : text;
};
