// Utils for ProfileForm

/**
 * Strip common Markdown syntax from AI-generated text so it renders cleanly
 * inside plain `<textarea>` and `<input>` fields. Conservative — only handles
 * the patterns models actually emit (bold, italic, inline code, headings,
 * bullet/number prefixes, link syntax, blockquotes).
 */
export function stripMarkdown(input: string | null | undefined): string {
  if (!input) return '';
  let s = String(input);
  // Code fences and inline code
  s = s.replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, '').replace(/```$/g, ''));
  s = s.replace(/`([^`]+)`/g, '$1');
  // Images ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Links [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  // Bold / italic (handle longest first)
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  s = s.replace(/___([^_]+)___/g, '$1');
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/__([^_]+)__/g, '$1');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2');
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, '$1$2');
  // Strikethrough ~~x~~
  s = s.replace(/~~([^~]+)~~/g, '$1');
  // Headings (#, ##, ...)
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  // Blockquotes
  s = s.replace(/^\s{0,3}>\s?/gm, '');
  // Bullet/number list markers at line start
  s = s.replace(/^\s{0,3}[-*+]\s+/gm, '');
  s = s.replace(/^\s{0,3}\d+\.\s+/gm, '');
  // Horizontal rules
  s = s.replace(/^\s*([-*_])\1{2,}\s*$/gm, '');
  // Collapse 3+ consecutive newlines
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}
