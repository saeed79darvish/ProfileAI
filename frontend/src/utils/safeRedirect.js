// Open-redirect protection: only allow same-origin relative paths.
// Reject protocol-relative URLs ("//evil.com"), absolute URLs, and anything
// that isn't a single-slash-prefixed path.
export function safeRedirect(target) {
  if (typeof target !== 'string') return null;
  const trimmed = target.trim();
  if (!trimmed) return null;
  // Must start with a single '/' and not '//' or '/\' (browser quirks).
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return null;
  // Reject any embedded scheme (e.g. javascript:, data:).
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  return trimmed;
}
