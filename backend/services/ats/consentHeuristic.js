/**
 * consentHeuristic · decide whether a required single checkbox is a
 * universal consent/attestation ("I acknowledge…", "I agree to…") that
 * the adapter can safely auto-check on behalf of the candidate, or a
 * substantive question that must be routed through training memory or
 * escalated as a human blocker.
 *
 * Layered resolution (mapFormFields calls these in order):
 *   1. Training memory row matching the normalized label — wins in both
 *      directions (force-check OR force-skip). Lets the candidate
 *      override the heuristic if it ever misfires.
 *   2. Label heuristic — conservative, only triggers for short labels
 *      that match an attestation allow-list AND the field is a single
 *      required checkbox (not part of a multi-box group, not a y/n
 *      radio pair).
 *   3. Otherwise: unresolved. Caller falls back to LLM / needsHuman.
 *
 * Every resolution returns a { value, via, reason } record the mapper
 * forwards up to the adapter's receipt so the timeline shows exactly
 * why each consent checkbox was ticked.
 */

// Attestation verbs — the words a real legal attestation uses.
const ATTESTATION_VERBS = [
  'acknowledge',
  'agree',
  'certify',
  'confirm',
  'consent',
  'authorize',
  'authorise',
  'attest',
  'accept',
  'understand',
  'have read',
];

// Real attestations almost universally open with first-person framing
// ("I acknowledge…", "I agree to…", "By checking this box, I…", "We
// consent…"). Command-form questions like "Confirm you have 5+ years
// of Python experience" never do. Anchoring on that pattern is the
// single biggest precision win we can make here.
//
// Accepted shapes (case-insensitive, ignoring leading whitespace/punct):
//   "I <verb>"
//   "We <verb>"
//   "By <anything>, I <verb>"
//   "By <anything> I <verb>"
//   "The undersigned <verb>"
const ATTESTATION_VERBS_RX = ATTESTATION_VERBS.map(escapeForRegex).join('|');
const CONSENT_RX = new RegExp(
  `^\\s*[*\\s]*(?:` +
    `(?:i|we)\\s+(?:${ATTESTATION_VERBS_RX})` +
    `|by\\s+[^.,;]{0,80}[,\\s]+(?:i|we)\\s+(?:${ATTESTATION_VERBS_RX})` +
    `|the\\s+undersigned\\s+(?:${ATTESTATION_VERBS_RX})` +
  `)\\b`,
  'i',
);

function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Kept for back-compat with callers / tests that imported the old array.
const ATTESTATION_WORDS = ATTESTATION_VERBS;

// Genuine legal attestations tend to be terse (<= 250 chars). Longer
// labels are more likely to be substantive eligibility questions wearing
// attestation vocabulary (e.g. "I confirm I have 5+ years of Python
// experience and am willing to relocate to Dublin for…") and should NOT
// auto-resolve.
const MAX_ATTESTATION_LEN = 250;

/**
 * Normalize a label so the training memory key is stable across small
 * wording changes and whitespace differences. Lowercased, collapsed
 * whitespace, punctuation stripped, trimmed.
 */
function normalizeLabel(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[\s\u00A0]+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * True if the field is a standalone required checkbox — not part of a
 * multi-value group, not a yes/no pair. We conservatively require
 * `groupSize` to be undefined (unknown → API path) or exactly 1.
 */
function isStandaloneRequiredCheckbox(field) {
  if (!field || field.required !== true) return false;
  const type = String(field.type || '').toLowerCase();
  if (type !== 'checkbox') return false;
  if (field.groupSize && field.groupSize > 1) return false;
  // If the field exposes multiple options (paired yes/no, decline, etc.)
  // treat it as substantive — not an attestation.
  if (Array.isArray(field.options) && field.options.length > 1) return false;
  return true;
}

/**
 * Try the training memory before the heuristic so the candidate can
 * force-check OR force-skip a field whose heuristic decision they
 * disagree with. Matches on a hash-like key derived from the label.
 *
 * Returns one of:
 *   { value: 'yes' | 'no', via: 'training-memory', reason }
 *   null  (nothing in memory for this field)
 */
function resolveFromMemory(field, memory) {
  if (!Array.isArray(memory) || memory.length === 0) return null;
  const key = normalizeLabel(field.label);
  if (!key) return null;
  const row = memory.find(
    (m) => m?.topic === 'consent' && normalizeLabel(m.key) === key,
  );
  if (!row) return null;
  const raw = String(row.value || '').toLowerCase().trim();
  if (['yes', 'true', '1', 'check', 'checked', 'agree'].includes(raw)) {
    return { value: 'yes', via: 'training-memory', reason: `memorized: "${row.value}"` };
  }
  if (['no', 'false', '0', 'uncheck', 'unchecked', 'skip', 'decline'].includes(raw)) {
    return { value: 'no', via: 'training-memory', reason: `memorized: "${row.value}"` };
  }
  // Any other string: treat as custom value the LLM/adapter should
  // handle; consent heuristic abstains.
  return null;
}

/**
 * Apply the conservative label heuristic. Only fires for single required
 * checkboxes whose label is short and clearly an attestation.
 */
function resolveFromHeuristic(field) {
  if (!isStandaloneRequiredCheckbox(field)) return null;
  const label = String(field.label || '').trim();
  if (!label) return null;
  if (label.length > MAX_ATTESTATION_LEN) return null;
  if (!CONSENT_RX.test(label)) return null;

  // Guard: labels that include a negation-like clause ("I do NOT agree")
  // are suspicious — abstain and let the human decide.
  if (/\b(not|don'?t|do not|never)\b.{0,20}\b(agree|consent|acknowledge|authori[sz]e|certify)\b/i.test(label)) {
    return null;
  }

  return {
    value: 'yes',
    via: 'consent-heuristic',
    reason: `label matched attestation allow-list (${label.length} chars)`,
  };
}

/**
 * Public entry. Resolve a single field; returns null if the caller
 * should fall through to the LLM mapper / needsHuman path.
 */
function resolveConsentField(field, memory) {
  if (!field) return null;
  const fromMemory = resolveFromMemory(field, memory);
  if (fromMemory) return fromMemory;
  const fromHeuristic = resolveFromHeuristic(field);
  if (fromHeuristic) return fromHeuristic;
  return null;
}

module.exports = {
  resolveConsentField,
  normalizeLabel,
  // Exported for unit tests and downstream overrides.
  _internal: {
    CONSENT_RX,
    ATTESTATION_WORDS,
    MAX_ATTESTATION_LEN,
    isStandaloneRequiredCheckbox,
    resolveFromMemory,
    resolveFromHeuristic,
  },
};
