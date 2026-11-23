/**
 * Questions only the candidate can answer: legal statements and personal
 * circumstances. A wrong answer here is a false statement made in the
 * candidate's name, so the AI never answers them. They are filled only
 * from an answer the candidate gave before (training memory), and
 * otherwise the send pauses and asks once.
 *
 * Found on a real Greenhouse form (HeartFlow): FDA debarment / OIG
 * exclusion, family working at the company, family who are customers,
 * "in the office 4 days a week". The AI had answered them unasked.
 */
const SENSITIVE_RE = new RegExp([
  'debar', 'excluded by', '\\boig\\b', 'sanction', 'convicted', 'conviction', 'felony', 'misdemeanor', 'criminal',
  'pleaded guilty', 'arrest',
  'family', 'relative', 'spouse', 'domestic partner', 'related to (anyone|someone|a current|an employee)',
  'conflict of interest', 'government (official|employee)', 'politically exposed',
  'non-?compete', 'non-?solicit', 'restrictive covenant',
  'terminated', 'dismissed', 'fired from', 'asked to resign',
  'security clearance', 'background check', 'drug (test|screen)',
  'days a week', 'in the office', 'on-?site requirement', 'in-office requirement',
].join('|'), 'i');

function isSensitiveQuestion(label) {
  return SENSITIVE_RE.test(String(label || ''));
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** An answer the candidate gave before for this exact question, if any. */
function rememberedAnswer(label, memory) {
  const q = norm(label).replace(/\s*\*$/, '');
  if (!q || !Array.isArray(memory)) return null;
  for (const m of memory) {
    const k = norm(m?.key);
    if (k && (k === q || (k.length > 20 && (q.includes(k) || k.includes(q))))) {
      const v = String(m?.value || '').trim();
      if (v) return v;
    }
  }
  return null;
}

module.exports = { isSensitiveQuestion, rememberedAnswer };
