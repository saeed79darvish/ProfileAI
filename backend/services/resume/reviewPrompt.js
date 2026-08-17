/**
 * Separate Review Pass
 *
 * The tailoring prompt used to end with STEP 6 (human read), STEP 7 (read
 * aloud) and STEP 8 (final sweep of six checks) — all inside the same
 * generation call that produced the draft. That is self-assessment: the model
 * declares the sweep passed in the same breath it writes the output, and the
 * declaration is not an observation of the text, it is a continuation of it.
 * Six metrics and five copies of "component-driven" shipped under a prompt that
 * said "no JD keyword appears more than twice" and "3-4 metrics total".
 *
 * This pass is structurally different in three ways:
 *   1. It runs AFTER the draft exists, as its own call, with its own system
 *      prompt whose job is correction rather than composition.
 *   2. It is handed machine-counted findings from draftAudit.js. It is not
 *      asked whether the resume has too many metrics; it is told there are six,
 *      where they are, and which to drop.
 *   3. Its output is re-audited by the caller. If the counts did not move, the
 *      pass failed and the caller does not get to pretend otherwise.
 *
 * It also receives the ORIGINAL resume, because half of what it must fix is
 * "this is not in the original" and it cannot verify that from the draft alone.
 */

const REVIEW_SYSTEM = `You are a resume review pass. You are NOT writing a resume — one already exists, and you are correcting specific, already-identified defects in it.

You receive: the candidate's ORIGINAL resume, the job description, a tailored DRAFT, and a list of DEFECTS found by a deterministic checker that counted metrics, counted repeated phrases, and diffed the draft against the original.

The defect list is authoritative. It is the output of counting, not of judgement. Do not argue with it, do not explain why a defect is acceptable, and do not return the draft unchanged because you disagree. Fix every listed defect and change nothing else.

Your single hard limit: you may not add anything to the resume that is not in the ORIGINAL. When a fix would require inventing something, remove the offending text instead and record the question. Return valid JSON only.`;

/**
 * @param {Object} opts
 * @param {Object} opts.draft - The tailored resume JSON to be corrected
 * @param {string} opts.originalResumeText - REQUIRED source of truth
 * @param {string} opts.jobDescription
 * @param {Object} opts.auditReport - From auditDraft()
 * @returns {{system: string, prompt: string, temperature: number, max_tokens: number}}
 */
function buildReviewPrompt({ draft, originalResumeText, jobDescription, auditReport }) {
  if (!originalResumeText || !String(originalResumeText).trim()) {
    throw new Error('buildReviewPrompt requires originalResumeText — the review pass cannot verify traceability without it');
  }

  const defects = auditReport.blocking || [];
  const defectBlock = defects.length
    ? defects.map((d, i) => `${i + 1}. ${d}`).join('\n')
    : '(none — return the draft unchanged and set reviewNotes accordingly)';

  const questionBlock = (auditReport.questions || []).length
    ? (auditReport.questions || []).map((q) => `- [${q.type}] ${q.term}: ${q.question}`).join('\n')
    : '(none)';

  // The review pass does not re-derive anything from the posting — the audit
  // already did that and handed over the specific spans to fix. The JD is here
  // only so a rewrite stays on-topic, and a long one (the Anthropic posting
  // runs 18k characters) was adding ~4.5k tokens per round to a call that is
  // already the slowest step in the request. Excerpt is enough for tone.
  const jdExcerpt =
    String(jobDescription || '').length > 4000
      ? `${String(jobDescription).slice(0, 4000)}\n[…posting truncated — the defect list below carries every specific you need…]`
      : jobDescription;

  const prompt = `═══ THE CANDIDATE'S ORIGINAL RESUME (the only source of truth) ═══
${originalResumeText}

═══ TARGET JOB DESCRIPTION (context only, excerpted) ═══
${jdExcerpt}

═══ TAILORED DRAFT UNDER REVIEW ═══
${JSON.stringify(draft, null, 2)}

═══ DEFECTS FOUND BY THE CHECKER (counted, not judged) ═══
${defectBlock}

═══ QUESTIONS ALREADY QUEUED FOR THE CANDIDATE ═══
These are being shown to the candidate separately. Do NOT resolve them by
guessing. Where a question concerns text currently in the draft, remove that
text — the candidate decides whether it goes back in.
${questionBlock}

═══ HOW TO FIX EACH CLASS OF DEFECT ═══

METRICS
- To drop a metric, rewrite its bullet so the sentence is complete without the
  number. Never leave the shape of a metric behind ("reduced load time
  significantly", "supported a large team") — that is a bullet that wanted a
  number and lost it.
- Never change, round, re-derive, or move a number that stays. Dropping is the
  only edit permitted on a metric.
- Keep the strongest and most JD-relevant placements; drop from the oldest and
  least relevant roles first.

REPETITION
- Keep the single most specific instance of the phrase. Rewrite the others to
  describe what actually happened in THAT role — different system, different
  scope, different words. Do not swap in a synonym of the same stock phrase;
  "modular component architecture" is the same defect as "component-driven
  design" wearing a hat.

FABRICATION
- Remove the term. Do not soften it, hedge it, or replace it with a vaguer
  claim pointing at the same thing. If a bullet exists only to carry the removed
  term, drop the bullet.
- If removing a term leaves a role thin, that is the correct outcome.

SUMMARY
- Maximum 3 sentences. No numbers. No span of four or more consecutive words
  that also appears in the posting. Plain description of what this person does
  and at what level.
- Every claim in the summary must be visible in a bullet below it. If it is not
  in a bullet, it does not go in the summary.

CONSISTENCY
- The role header title is authoritative. Rewrite the bullet to match it, never
  the reverse — the header is what the employer verifies.

EDUCATION
- Restore any institution, degree, or year present in the original. Education is
  never shortened for relevance; it is a record, not a pitch.

ARTIFACTS
- Apply the exact substitution given. These are line-wrap damage from the source
  PDF, not stylistic choices.

═══ OUTPUT FORMAT ═══
Return a JSON object:
{
  "resume": { ...the corrected draft, same shape as the draft you were given, with every listed defect fixed... },
  "fixes": [
    {"defect": "the defect number and short name", "action": "what you changed", "location": "summary / experience_2 / skills / education"}
  ],
  "openQuestions": [
    {"type": "unsupported_skill | unsupported_summary_claim | location_conflict | other", "term": "the term or topic", "question": "the question for the candidate, in plain language"}
  ],
  "unfixable": [
    {"defect": "defect that could not be fixed without inventing something", "why": "one sentence"}
  ]
}

The "resume" object must contain the COMPLETE resume, not a patch — every field
from the draft, corrected. Return ONLY valid JSON.`;

  return {
    system: REVIEW_SYSTEM,
    prompt,
    // Low temperature: this pass performs specified corrections, and creative
    // variance is how a "fix" turns into a rewrite that introduces new defects.
    temperature: 0.2,
    max_tokens: 6000,
  };
}

module.exports = { buildReviewPrompt, REVIEW_SYSTEM };
