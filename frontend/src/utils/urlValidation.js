/**
 * Shared URL validation used by the profile wizard, the profile editor, and
 * (mirrored on the backend) the save endpoint.
 *
 * Why this exists: the editor's Basic Info section already validated
 * LinkedIn / GitHub / Portfolio URLs, but the wizard's project link and
 * the editor's per-project Live Demo / Source Code / Image URL inputs
 * did not. Free-text strings like "not-a-valid-url" — and worse,
 * `javascript:` payloads — were being persisted. This module is the
 * single source of truth so every URL input behaves the same way.
 */

/**
 * Strict check: is `raw` a syntactically valid http(s) URL we'd be happy
 * to render as a link?
 *
 *  - Requires `http://` or `https://` (rejects `javascript:`, `data:`,
 *    `mailto:`, `file:`, `ftp:`, etc.)
 *  - Requires a hostname with a TLD (rejects "http://abc") OR explicit
 *    "localhost" for dev use.
 *  - Trims whitespace; empty / non-string returns false.
 *
 * @param {unknown} raw
 * @returns {boolean}
 */
export const isValidHttpUrl = (raw) => {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (_) {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (!parsed.hostname) return false;
  if (parsed.hostname === 'localhost') return true;
  // Reject single-label hostnames like "abc" — must have a TLD.
  if (!parsed.hostname.includes('.')) return false;
  return true;
};

/**
 * Auto-fixer for URLs pasted without a protocol. Users type
 * `www.linkedin.com/in/name` or `linkedin.com/in/name`; the strict
 * validator above rejects those. Call this on blur / before validation
 * to promote them to `https://…` when they clearly look like a URL.
 *
 *  - Returns unchanged input for empty / non-string / already-prefixed
 *    values, and for schemes we don't touch (`mailto:`, `tel:`, etc.).
 *  - Only prepends `https://` when the token looks like `host[/…]` with
 *    a dot in the host (so it won't turn "not-a-url" into a fake URL).
 *
 * @param {unknown} raw
 * @returns {string}
 */
export const normalizeHttpUrl = (raw) => {
  if (typeof raw !== 'string') return raw == null ? '' : String(raw);
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // Already has a scheme of some kind — leave it alone. (Includes
  // http/https, and non-web schemes we don't want to rewrite.)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  // Bail on values that clearly aren't URLs (whitespace, no dot).
  if (/\s/.test(trimmed)) return trimmed;
  const hostPart = trimmed.split('/')[0];
  if (!hostPart.includes('.')) return trimmed;
  return `https://${trimmed}`;
};

/**
 * Inline validator. Returns an error string for the UI (helperText) or
 * '' when the value is acceptable.
 *
 * @param {unknown} value
 * @param {{
 *   fieldLabel?: string,
 *   allowEmpty?: boolean,
 *   hostMatch?: { regex: RegExp, message: string },
 * }} [opts]
 * @returns {string}
 */
export const validateHttpUrl = (value, opts = {}) => {
  const { fieldLabel = 'URL', allowEmpty = true, hostMatch } = opts;
  const v = (value == null ? '' : String(value)).trim();
  if (!v) return allowEmpty ? '' : `${fieldLabel} is required.`;
  if (!isValidHttpUrl(v)) {
    return 'Enter a valid URL starting with http:// or https:// (e.g., https://example.com).';
  }
  if (hostMatch) {
    try {
      const u = new URL(v);
      if (!hostMatch.regex.test(u.hostname)) {
        return hostMatch.message;
      }
    } catch (_) {
      // isValidHttpUrl above guarantees parsability — unreachable.
    }
  }
  return '';
};
