/**
 * Profile Coach prompts — the conversational profile builder.
 *
 * The coach walks a FIXED question ladder that lives on the client
 * (frontend/src/pages/ProfileCoach/constants.ts). The model never decides
 * what to ask next; it only does the two things a script can't:
 *
 *   1. interpretAnswerPrompt  — turn a free-text / voice answer into the
 *      structured field(s) that step was asking for.
 *   2. writeBulletsPrompt / writeSummaryPrompt — turn the collected raw
 *      material into resume-quality prose at the end of the conversation.
 *
 * Keeping question order out of the model is deliberate: chip answers then
 * cost zero AI calls, the flow is deterministic and testable, and a model
 * outage degrades to a working (if less flexible) builder rather than a
 * dead page.
 */

// Shared voice rules. Kept deliberately in sync with ./profile.js — see the
// note there; the coach writes the same kind of copy, so it inherits the
// same banned-word list rather than growing a second, drifting one.
const { VOICE_AND_TONE } = require('./profile');

/**
 * interpretAnswerPrompt — map one free-text answer onto one step's fields.
 *
 * `expects` describes the shape the step wants back, e.g.
 *   { title: 'string', company: 'string', startDate: 'YYYY-MM' }
 * The model must return ONLY those keys. Anything it isn't sure about it
 * omits — a missing key means "ask the user", which is always better than
 * a confidently wrong guess sitting in their resume.
 *
 * @param {object} p
 * @param {string} p.question   the question the coach just asked
 * @param {object} p.expects    field name → description of the wanted value
 * @param {string} p.answer     the user's raw reply (typed or transcribed)
 * @param {object} [p.context]  what we already know, for disambiguation
 */
const interpretAnswerPrompt = ({ question, expects, answer, context = {} }) => `You are parsing one answer from a profile-building conversation into structured data.

THE QUESTION ASKED:
${question}

THE FIELDS TO EXTRACT (return only these keys):
${JSON.stringify(expects, null, 2)}

WHAT WE ALREADY KNOW ABOUT THIS PERSON (for disambiguation only — do not copy into your answer):
${JSON.stringify(context, null, 2)}

THE PERSON'S ANSWER:
"""
${answer}
"""

RULES:
- Return ONLY a JSON object. No prose, no markdown fence.
- Include a key ONLY if the answer actually supports a value for it. Omit anything uncertain — a missing key means we ask them, which is fine. A wrong value ends up in their resume, which is not.
- Never invent employers, dates, numbers, schools, or job titles that aren't in the answer.
- Preserve the person's own nouns. If they say "I do growth stuff for a fintech", the title is what they said, not "Growth Marketing Manager".
- Dates: normalize to YYYY-MM when a month is clear, YYYY when only a year is. Use "Present" for an ongoing role.
- If the answer is off-topic, a question back at you, or says nothing useful, return {}.

Return the JSON object now.`;

/**
 * clarifyPrompt — one short spoken-style follow-up when an answer didn't
 * yield the fields we needed. Deliberately capped at a single sentence:
 * this is a chat bubble, not an essay, and long clarifications read as
 * the bot being stuck.
 */
const clarifyPrompt = ({ question, answer, missing }) => `A person is building their professional profile by chatting with a coach.

The coach asked: "${question}"
They replied: "${answer}"

That reply didn't give us: ${missing.join(', ')}.

Write ONE short follow-up question (max 20 words) that gets the missing piece. Sound like a helpful person, not a form. Don't apologize, don't repeat their words back at them.

If they pushed back on why you're asking, give half a sentence of reason and then still ask.

Your reply MUST end with a question mark. Return only the question text.`;

/**
 * writeBulletsPrompt — turn a rambling "what did you actually do there"
 * answer into 2-4 resume bullets.
 */
const writeBulletsPrompt = ({ title, company, rawAnswer }) => `Turn this person's own description of their work into resume bullet points.

${VOICE_AND_TONE}

ROLE: ${title || 'Unknown'}${company ? ` at ${company}` : ''}

WHAT THEY SAID:
"""
${rawAnswer}
"""

RULES:
- 2 to 4 bullets. Each one line, under 25 words.
- Use ONLY what they said. If they gave no numbers, write no numbers — do not estimate, round, or imply scale that isn't there.
- Keep their domain nouns exactly (product names, tools, team names).
- No trailing periods.

Return a JSON array of strings. Nothing else.`;

/**
 * writeSummaryPrompt — the profile summary, written from everything the
 * conversation collected. Runs once, at the end.
 */
const writeSummaryPrompt = (draft) => `Write a short professional summary for this person's profile, based only on what they told us.

${VOICE_AND_TONE}

WHAT THEY TOLD US:
${JSON.stringify({
  title: draft.title,
  level: draft.level,
  sector: draft.sector,
  location: draft.location,
  experience: draft.experience,
  skills: draft.skills,
  education: draft.education,
}, null, 2)}

RULES:
- 2 to 3 sentences, first person implied but no "I" — the way a resume summary reads.
- Lead with what they actually do and how long they've done it. No throat-clearing.
- Mention at most 3 skills, and only ones listed above.
- Invent nothing. If the material is thin, write a shorter summary rather than padding it.

Return only the summary text.`;

module.exports = {
  interpretAnswerPrompt,
  clarifyPrompt,
  writeBulletsPrompt,
  writeSummaryPrompt,
};
