/**
 * Job scam/spam heuristic detector.
 *
 * No labeled data and no existing signal exists for this corpus, so rather
 * than a trained classifier this is a deterministic, zero-cost, zero-latency
 * pattern match over well-documented job-scam red flags (FTC / BBB consumer
 * guidance: advance-fee requests, check-cashing/reshipping mule recruitment,
 * gift-card payment, off-platform-only contact, "no interview necessary").
 * These phrases essentially never appear in a legitimate corporate ATS
 * posting, so false positives are rare — but to be extra safe, a single job
 * is only flagged once its combined signal score crosses a threshold (one
 * strong signal, or two moderate ones), not on a lone weak match.
 *
 * Pure function, no I/O — easy to unit-test and safe to run inline in the
 * hot ingest path (services/externalJobService.js syncBoard).
 *
 * Public surface: detectScamSignals(job) -> { flagged: boolean, score: number, reasons: string[] }
 */

// Score 2: essentially never legitimate. Any single hit is enough to flag.
const STRONG_PATTERNS = [
  // Requires the imperative "wire X to <recipient>" framing, not bare
  // "wire funds/money" — finance-industry postings (payments, banking,
  // fintech) legitimately discuss wire-transfer infrastructure by name
  // (e.g. "Fedwire Funds Service", "wire funds processing") without ever
  // instructing the CANDIDATE to send money. Observed on a real Bank of
  // America "USD Clearing" posting during testing — see git log.
  [/(please\s+)?wire\s+(the\s+)?(funds|money)\s+to\s+(us\b|our\b|me\b|this\b|the\s+following)/i, 'wire transfer request'],
  [/money\s*order/i, 'money order request'],
  [/(cash|deposit)\s+(a\s+|this\s+|the\s+)?check/i, 'check-cashing scheme'],
  [/(buy|purchase)\s+(a\s+|some\s+)?gift\s*cards?/i, 'gift-card payment request'],
  [/(itunes|google\s*play|amazon)\s+gift\s*card/i, 'gift-card payment request'],
  [/re-?ship(ping)?\s+(packages?|items?|merchandise)/i, 'reshipping / package-forwarding scheme'],
  [/forward(ing)?\s+packages?\s+(from|to)\s+(your|my)\s+(home|address)/i, 'reshipping / package-forwarding scheme'],
  [/money\s*mule/i, 'money mule recruitment'],
  [/send\s+(us\s+)?your\s+(bank|routing)\s+(details|information|account)/i, 'unsolicited bank-details request'],
  [/(pay|purchase)\s+(a\s+|your\s+own\s+)?(registration|training|starter\s*kit|processing)\s+fee/i, 'advance-fee request'],
  [/purchase\s+your\s+own\s+equipment\s+before\s+start/i, 'advance-fee equipment purchase request'],
  [/(telegram|whatsapp)\s+(only|for\s+(more\s+)?details)/i, 'off-platform-only contact (Telegram/WhatsApp)'],
  [/no\s+interview\s+(necessary|required|needed)/i, 'no-interview-necessary hiring'],
];

// Score 1: common in legitimate postings alone, only meaningful combined
// with another signal.
const MODERATE_PATTERNS = [
  [/\$\d{3,}\s*(\/|per\s+)(day|hour)\b.*no\s+experience/i, 'unrealistic pay + no-experience combo'],
  [/no\s+experience.*\$\d{3,}\s*(\/|per\s+)(day|hour)\b/i, 'unrealistic pay + no-experience combo'],
  [/immediate\s+(hire|start).*no\s+interview/i, 'immediate-hire pressure tactic'],
  [/text\s+["']?[\w\s]*["']?\s+to\s+\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/i, 'personal-number text-to-apply'],
];

const SCAM_SCORE_THRESHOLD = 2;

// Legitimate employers increasingly add an anti-scam disclaimer to their OWN
// postings, warning candidates about impersonators ("we will NEVER ask you to
// deposit a check, purchase equipment, or wire money…"). That disclaimer uses
// the exact same red-flag phrases the detector looks for, so a naive match
// flags the company for warning people about scammers. If a negation/warning
// cue appears in the ~120 chars immediately before a match, that hit doesn't
// count. (Observed on a real Duolingo posting during testing — see git log.)
const NEGATION_WINDOW = 150;
const NEGATION_CUE = /\b(never|won'?t|will\s+not|will\s+\w+\s+ever|nor\s+will|don'?t|do\s+not|beware|should\s+never|impersonat|is\s+a\s+scam|scam\s+alert|fraudulent|legitimate\s+\w+\s+will)\b/i;

function scanPatterns(haystack, patterns, weight) {
  let score = 0;
  const reasons = [];
  for (const [pattern, label] of patterns) {
    const match = haystack.match(pattern);
    if (!match) continue;
    const start = Math.max(0, match.index - NEGATION_WINDOW);
    const precedingText = haystack.slice(start, match.index);
    if (NEGATION_CUE.test(precedingText)) continue; // anti-scam disclaimer, not a scam
    score += weight;
    reasons.push(label);
  }
  return { score, reasons };
}

function detectScamSignals(job) {
  const haystack = [job?.title, job?.description, job?.requirements]
    .filter(Boolean)
    .join('\n');

  if (!haystack) return { flagged: false, score: 0, reasons: [] };

  const strong = scanPatterns(haystack, STRONG_PATTERNS, 2);
  const moderate = scanPatterns(haystack, MODERATE_PATTERNS, 1);
  const score = strong.score + moderate.score;
  const reasons = [...strong.reasons, ...moderate.reasons];

  return { flagged: score >= SCAM_SCORE_THRESHOLD, score, reasons };
}

module.exports = { detectScamSignals, SCAM_SCORE_THRESHOLD };
