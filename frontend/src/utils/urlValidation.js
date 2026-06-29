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
