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
  // Someone with no employer still has work worth describing, and for a new
  // grad or a career changer this is the whole of it.
  projects: draft.projects,
  skills: draft.skills,
  education: draft.education,
  wants: draft.target,
  why: draft.targetWhy,
}, null, 2)}

RULES:
- 2 to 3 sentences, first person implied but no "I" — the way a resume summary reads.
- Lead with what they actually do and how long they've done it. No throat-clearing.
- If they have no jobs listed, lead with what they have built or studied instead. Never write around the gap or apologise for it.
- Mention at most 3 skills, and only ones listed above.
- "wants" is where they are heading, not where they are. At most one short closing clause about direction, and only if what they already do is fully said first. A summary that opens with ambition reads as a cover letter.
- Invent nothing. If the material is thin, write a shorter summary rather than padding it.

Return only the summary text.`;

/**
 * reviewProfilePrompt — the coach's read on a resume it has just been handed.
 *
 * The findings are supplied, not requested: coachInspect.js counted them.
 * Asking a model to both find and explain problems produces generic advice
 * plus the occasional confident claim about something that isn't in the
 * document. Handing it counted facts and asking only for the explanation
 * keeps every criticism traceable to something real.
 *
 * @param {object} p
 * @param {object} p.profile   the parsed profile
 * @param {object} p.inspection output of inspectProfile()
 * @param {string} [p.sector]  what field they said they are in
 */
const reviewProfilePrompt = ({ profile, inspection, sector }) => `You are a career coach who has just read this person's resume. Give them your honest read.

${VOICE_AND_TONE}

═══ THEIR PROFILE ═══
${JSON.stringify({
  title: profile.title,
  summary: profile.summary,
  experience: profile.experience,
  skills: profile.skills,
  education: profile.education,
  projects: profile.projects,
}, null, 2)}

═══ WHAT A CHECKER COUNTED (facts, not opinions — do not dispute them) ═══
${JSON.stringify(inspection, null, 2)}

${sector ? `They work in: ${sector}\n` : ''}
═══ WHAT TO RETURN ═══
{
  "opening": "2-3 sentences, spoken to them directly. Lead with the single most useful true thing you noticed. Never open with praise you cannot justify from the profile.",
  "working": ["1-3 things that genuinely help them, each tied to something actually in the profile"],
  "fix": [{"what": "the problem, in their terms", "why": "what a recruiter does because of it", "how": "the concrete next step"}],
  "probes": ["1-3 questions whose answers would let you fix the biggest gaps. Ask about work they did, never about what they want the resume to say."]
}

RULES:
- Every claim traces to the profile or the counted findings. If it is not in there, you do not know it.
- Order "fix" by what costs them interviews first. Blockers before polish.
- Do not pad "working" to look encouraging. One honest strength beats three invented ones. An empty list is allowed.
- Probes must be answerable from memory in a sentence. "What was the team size?" not "What are your career goals?"
- Talk to them, not about them. "Your dispatch role has no bullets" — not "the candidate's role lacks detail".
- NEVER use the word "banned". It appears above because these are instructions to you; to the reader it is meaningless jargon about a checker they cannot see. Same for "finding", "severity" and "checker". Speak as if you noticed everything yourself, and quote the actual phrase you object to: not "starts with a banned opener" but "starts with 'Responsible for', which tells a recruiter nothing".
- No preamble, no sign-off, no markdown. Return only the JSON object.`;

/**
 * targetAssessmentPrompt — how hard is the target, and what closes the gap.
 *
 * `market` comes from coachMarket.countOpenings and may contain nulls, which
 * mean "not measured" and never "zero". The prompt is explicit about that
 * because inventing "there are no jobs for you" out of a missing number is
 * the single most damaging thing this feature could do to someone.
 */
const targetAssessmentPrompt = ({ profile, inspection, target, market, motivation, blocker }) => `You are a career coach. This person wants a specific kind of role next. Tell them honestly how far away it is and what closes the gap.

${VOICE_AND_TONE}

═══ WHERE THEY ARE ═══
${JSON.stringify({
  title: profile.title,
  experience: profile.experience,
  skills: profile.skills,
  education: profile.education,
  counts: inspection.counts,
}, null, 2)}

═══ WHERE THEY WANT TO BE ═══
${target}
${motivation ? `\nWHY THEY WANT IT (their words): ${motivation}` : ''}
${blocker ? `WHAT THEY THINK IS STOPPING THEM (their words): ${blocker}` : ''}

═══ LIVE POSTINGS IN OUR JOB DATA ═══
${JSON.stringify(market, null, 2)}
A null total or nearby means WE DID NOT MEASURE IT. It does NOT mean zero.
Never say or imply there are no jobs when the number is null — say nothing
about volume at all in that case.

═══ WHAT TO RETURN ═══
{
  "verdict": "within reach" | "a stretch" | "a big jump",
  "headline": "one sentence telling them where they stand. Direct, not brutal, not falsely upbeat.",
  "why": ["1-3 specific reasons for that verdict, each grounded in their actual history"],
  "closes": [{"what": "the concrete thing that moves them closer", "effort": "quick" | "weeks" | "months"}]
}

RULES:
- Judge the gap from their real history. Do not assume experience they have not listed.
- If they said why they want it, the headline should show you heard it: someone chasing scope and someone chasing stability are not asking the same question, even about the same job title.
- If they named what they think is stopping them, address it directly and honestly — confirm it, or tell them it is not the real obstacle and say what is. Ducking the thing they are worried about is how advice gets ignored.
- "closes" items must be things they can actually do: a project to build, a skill to evidence, a number to dig up, a way to reframe work they already did. Not "network more".
- If they are already qualified, say so plainly and make "closes" about how they present it, not about becoming someone else.
- No preamble, no markdown. Return only the JSON object.`;

/**
 * answerAsidePrompt — the person asked us something instead of answering.
 *
 * "What is this?", "why do you need that?", "do I need an account?", "I have
 * a question". Before this existed the text was taken as the answer, so
 * someone's job title became "I have a quetion?" and went into the headline a
 * recruiter reads.
 *
 * Deliberately narrow. It answers about this conversation, this product and
 * their own job search, and it does not do anything else — a chat box on a
 * profile builder is not a general assistant, and the fastest way to make one
 * untrustworthy is to let it improvise about pricing, or about features we do
 * not have.
 */
const answerAsidePrompt = ({ question, asked, context = {} }) => `Someone is building their profile in a chat with you, and instead of answering your question they asked one of their own. Answer it, briefly, then stop.

${VOICE_AND_TONE}

THE QUESTION YOU HAD ASKED THEM: ${asked || '(none)'}
WHAT THEY ASKED YOU: """${question}"""
WHAT YOU ALREADY KNOW ABOUT THEM: ${JSON.stringify(context)}

WHAT THIS PRODUCT DOES, so you answer about the real thing:
- A short conversation builds their profile. They can tap chips or type. About two minutes.
- It is free, needs no account to go through, and the account is only asked for at the end so the profile can be saved.
- Their answers become a profile and a resume they can edit before anything is published.
- It can read a resume or a LinkedIn export to fill most of it in.
- Afterwards the profile powers tailoring a resume to a specific job, a browser extension that fills applications, cover letters, and a public portfolio page.

RULES:
- One to three sentences. No preamble, no bullet points, no markdown.
- Answer only about this conversation, this product, or their job search and career. If they ask about anything else, say in one line that you are here to help build their profile, and leave it there.
- Never invent a feature, a price, a guarantee or a number. If you do not know, say you do not know.
- Do not re-ask your question — the conversation puts it back in front of them straight after you.
- If they said they do not know the answer, tell them it is fine to skip it and what happens if they do.
- Plain text only.`;

module.exports = {
  answerAsidePrompt,
  interpretAnswerPrompt,
  reviewProfilePrompt,
  targetAssessmentPrompt,
  clarifyPrompt,
  writeBulletsPrompt,
  writeSummaryPrompt,
};
