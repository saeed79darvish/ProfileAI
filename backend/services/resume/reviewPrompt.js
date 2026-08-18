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
 * @param {'review'|'enforce'} [opts.mode] - 'enforce' is the narrow second round
 *   that runs when the four recurring defect classes survive the general review.
 * @returns {{system: string, prompt: string, temperature: number, max_tokens: number}}
 */
function buildReviewPrompt({ draft, originalResumeText, jobDescription, auditReport, mode = 'review' }) {
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

  // The enforcement round is handed defects that have ALREADY been through a
  // review pass told to fix them. Saying so matters: the failure mode being
  // corrected is a model that reads a defect list, judges the text acceptable,
  // and returns it unchanged with a note explaining why.
  const enforceHeader = mode === 'enforce' ? `
═══ THIS IS A SECOND, NARROWER PASS ═══
Every defect below was already listed for a review pass, and every one of them
survived it. They are the four failures this product has shipped on three
consecutive runs: metrics copied through wholesale, a phrase used three or more
times, banned vocabulary, and posting language pasted in verbatim.

Do not evaluate whether they are worth fixing. They are counted facts about the
text, the counting has been done, and the only acceptable response is edited
text. Change nothing that is not on the list.
` : '';

  const prompt = `${enforceHeader}═══ THE CANDIDATE'S ORIGINAL RESUME (the only source of truth) ═══
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
- Reduce the phrase to AT MOST TWO uses. Keep the two most specific instances and
  rewrite the rest to describe what actually happened in THAT role — different
  system, different scope, different words. Do not swap in a synonym of the same
  stock phrase; "modular component architecture" is the same defect as
  "component-driven design" wearing a hat.
- A methodology never goes in the Skills list. If a phrase was removed from
  Skills, the bullet that demonstrates the practice is the evidence for it.

BANNED
- Rewrite the sentence with the plain word for what happened. Do not reach for a
  different impressive word; "leveraged" becoming "harnessed" is the same defect.
- These words are usually in the candidate's original resume. That is not a
  reason to keep them: the original is the source of truth for FACTS — what the
  candidate did, where, and with what — never for wording.
- For an abstract closing clause, delete it and end the bullet at its last
  factual word. Do not replace it with a different unfalsifiable clause.

JD LANGUAGE
- A run of four or more consecutive words shared with the posting must go,
  anywhere in the resume. Express the same qualification in the candidate's own
  words, anchored to something they actually did.
- If the only honest way to say it is to copy the posting, the candidate does not
  have that qualification in the form the posting wants it. Remove the claim and
  record the question.

IDENTITY
- The professional identity in the summary may only move as far as the bullets
  support. If the original reads "Frontend engineer" and no bullet shows backend
  ownership, the summary says "Frontend engineer" — the posting does not get to
  relabel the candidate.
- Never resolve a shortfall by widening the label. The bullets carry whatever
  partial support exists; the shortfall goes to the candidate as a gap.

TAPERING
- Cut bullets from the role named, starting with the least JD-relevant. Never add
  bullets to another role to even out the shape.

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
