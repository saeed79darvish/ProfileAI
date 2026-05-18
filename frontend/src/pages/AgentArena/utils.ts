import DOMPurify from 'dompurify';
import { STATUS_MAP } from './constants';

export const formatStatus = (status: string): string => {
  return STATUS_MAP[status] || status;
};

/**
 * Parse markdown-like formatting in agent messages to HTML.
 */
export const parseMessageContent = (content: string): string => {
  if (!content) return '';

  // Escape HTML entities before any markdown transformation
  let parsed = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  parsed = parsed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  parsed = parsed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  parsed = parsed.replace(/^(\d+\.\s)/gm, '<span class="list-number">$1</span>');
  parsed = parsed.replace(/^[•●]\s/gm, '<span class="bullet">•</span> ');

  return DOMPurify.sanitize(parsed);
};
