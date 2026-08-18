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

const PROFILE_REVIEW_SYSTEM = `You are a resume review pass. You are NOT writing a profile — one already exists, and you are correcting specific, already-identified defects in it.

You receive: the candidate's OWN PROFILE as they wrote it, an ENHANCED version of it, and a list of DEFECTS found by a deterministic checker that counted numbers, counted repeated openers, and diffed the enhanced text against what the candidate actually wrote.

The defect list is authoritative. It is the output of counting, not of judgement. Do not argue with it, do not explain why a defect is acceptable, and do not return the profile unchanged because you disagree. Fix every listed defect and change nothing else.

Your single hard limit: you may not add anything that is not in the candidate's own profile. When a fix would require inventing something, remove the offending text instead. Return valid JSON only.`;

/**
 * The enhancement pass's review round.
 *
 * Deliberately narrower than the tailoring review: there is no posting, so
 * nothing here is about relevance, keywords or identity drift. What is left is
 * the honesty and the human-writing half of the list — which is the half that
 * matters most on this pass, because its output becomes the stored profile that
 * every future application starts from. A defect fixed here is fixed for every
 * tailored resume the candidate ever generates; one left standing recurs in all
 * of them.
 *
 * @param {Object} opts
 * @param {Object} opts.profile - the enhanced profile to correct
 * @param {string} opts.sourceText - the candidate's pre-enhancement profile
 * @param {Object} opts.auditReport - from auditProfile()
 */
function buildProfileReviewPrompt({ profile, sourceText, auditReport }) {
  if (!sourceText || !String(sourceText).trim()) {
    throw new Error('buildProfileReviewPrompt requires sourceText — the review pass cannot verify traceability without it');
  }

  const defects = (auditReport && auditReport.needsRewrite) || [];
  const defectBlock = defects.length
    ? defects.map((d, i) => `${i + 1}. ${d}`).join('\n')
    : '(none — return the profile unchanged)';

  const prompt = `═══ THE CANDIDATE'S OWN PROFILE (the only source of truth) ═══
${sourceText}

═══ THE ENHANCED VERSION UNDER REVIEW ═══
${JSON.stringify(profile, null, 2)}

═══ DEFECTS FOUND BY THE CHECKER (counted, not judged) ═══
${defectBlock}

═══ HOW TO FIX EACH CLASS OF DEFECT ═══

METRICS
- A number that is not in the candidate's own profile is removed, not replaced.
  Rewrite the line so it is a complete thought without it: "Built the customer
  dashboard" is finished; "built the dashboard used by active users" is a
  sentence still waiting for a number.
- Never leave the shape of a metric behind — "improved performance
  significantly", "supported a large team" — and never round, re-derive or move
  a number that stays. This profile is the record; every real figure in it must
  survive exactly as the candidate wrote it.
- A range or a hedge ("25-30%", "roughly 40%") becomes the exact figure the
  profile states, or no figure.

SUMMARY
- Three sentences maximum, and NO NUMBERS of any kind — not a percentage, not a
  headcount, not "serving millions of users". A scale claim is a metric written
  in words. The figures stay in the bullets, where the work behind them is
  visible.
- No self-rating and no adjective stacking. Say what the person does and at what
  level, then stop.

BANNED
- Rewrite the sentence with the plain word for what happened. Do not reach for a
  different impressive word; "leveraged" becoming "harnessed" is the same
  defect, and "expert in React" becoming "deep expertise in React" is the same
  self-rating.
- These words are usually in the candidate's own writing. That is not a reason
  to keep them: their profile is the source of truth for FACTS, never for
  wording.

VARIATION
- Rewrite the repeated opening verbs so each names what that specific job
  involved, and let bullet lengths differ — one short clause among longer lines
  is what human writing looks like. Do not add material to lengthen a bullet;
  shorten the others instead.
- An abstract quality chain ("usability, accessibility, and maintainability")
  collapses to the one that the work actually turned on, with what changed.

SKILLS
- Remove any skill the candidate's own profile does not evidence. Do not soften
  it into a vaguer claim pointing at the same thing.

CONSISTENCY & EDUCATION
- The role header title is authoritative; fix the bullet, never the header.
- Restore any institution, degree or year present in the candidate's profile.
  Education is a record, not a pitch, and is never shortened.

═══ OUTPUT FORMAT ═══
Return a JSON object:
{
  "profile": { ...the corrected profile, same shape and same fields as the one you were given, with every listed defect fixed... },
  "fixes": [
    {"defect": "the defect number and short name", "action": "what you changed", "location": "summary / experience_2 / skills / education"}
  ],
  "unfixable": [
    {"defect": "defect that could not be fixed without inventing something", "why": "one sentence"}
  ]
}

The "profile" object must contain the COMPLETE profile, not a patch — every
field from the version you were given, corrected. Return ONLY valid JSON.`;

  return {
    system: PROFILE_REVIEW_SYSTEM,
    prompt,
    // Same reasoning as the tailoring review: this pass performs specified
    // corrections, and creative variance is how a "fix" becomes a rewrite that
    // introduces new defects.
    temperature: 0.2,
    max_tokens: 4000,
  };
}

module.exports = {
  buildReviewPrompt,
  buildProfileReviewPrompt,
  REVIEW_SYSTEM,
  PROFILE_REVIEW_SYSTEM,
};
