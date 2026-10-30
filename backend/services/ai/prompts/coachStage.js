/**
 * Who the coach is talking to, by career stage.
 *
 * The coach asks a new grad, a career changer and a senior engineer for
 * different things, and judges their profiles by different standards. The
 * page sends the stage as a readable label in profile.about.careerStage (the
 * typed coach) or as an id in profile.careerStage (the call, which gets the
 * raw draft); both resolve to the same guidance here, so the typed coach,
 * the call, the final read and the suggested answers all agree.
 */

const { COACH_GUARDRAILS } = require('./coachGuardrails');
const { VOICE_AND_TONE } = require('./profile');

const STAGE_IDS = ['experienced', 'internship', 'new_grad', 'career_change', 'self_taught'];

/** The career stage id from either form the page sends, or ''. */
const stageOf = (profile = {}) => {
  const raw = String(profile.careerStage || profile.about?.careerStage || '').toLowerCase();
  if (!raw) return '';
  if (STAGE_IDS.includes(raw)) return raw;
  if (/new grad|student/.test(raw)) return 'new_grad';
  if (/internship|co-?op|placement|apprentice/.test(raw)) return 'internship';
  if (/chang|pivot/.test(raw)) return 'career_change';
  if (/self-taught|bootcamp|learned/.test(raw)) return 'self_taught';
  if (/experience/.test(raw)) return 'experienced';
  return '';
};

const GUIDANCE = {
  new_grad: `They are a new graduate or still a student, with no full-time job yet.
Their evidence is their studies, projects, internships, part-time work and
anything they led or organised. Never ask about a job, a team they managed or
years of experience, and never make them feel behind for not having them.
Ask what they built and what came of it. Aim the profile at entry-level and
graduate roles.`,
  internship: `So far they have done internships or co-ops, no full-time role.
Treat the internships as real work: what they shipped, who used it, what they
learned. Their projects and studies count as much. Aim at entry-level roles
and return offers.`,
  career_change: `They are changing careers. Their past jobs are in another field: read
them for what carries over to where they are heading (people, numbers,
customers, ownership), not for the old job itself. What they have done in the
new field already (courses, projects, freelance work) is the most important
evidence they have, so ask for it. Be honest about the gap, and specific about
how to close it.`,
  self_taught: `They are self-taught or came through a bootcamp. What they built is their
evidence, far more than any certificate: what it does, who used it, what was
hard. Ask for links to the work. Do not apologise for the lack of a degree,
and do not ask about one.`,
  experienced: `They have real work experience. What sets them apart is scope and result:
the size of what they owned, the numbers that moved, what got better because
of them. If they want to level up, ask for the evidence that they already work
at the next level.`,
};

/** A block for a prompt: who this person is, and what that changes. */
const stageGuidance = (profile = {}) => {
  const stage = stageOf(profile);
  return stage ? `═══ WHO YOU ARE TALKING TO ═══\n${GUIDANCE[stage]}` : '';
};

/**
 * The final read before the profile is built. The whole draft against who
 * they are and where they are heading: up to two questions on what a
 * recruiter would miss, or none when it is ready.
 */
const gapCheckPrompt = ({ profile }) => `You are Remi, a career coach. You have just finished a short conversation building someone's profile, and you are reading it through once before it is put together.

${COACH_GUARDRAILS}

${VOICE_AND_TONE}

No em dashes (—) anywhere in what you write.

${stageGuidance(profile)}

═══ THE PROFILE SO FAR ═══
${JSON.stringify(profile, null, 2)}

Read it as a recruiter for the role they want (about.target, or their title
if there is none) would. What is the one thing, or at most two, that would
make it clearly stronger and that only they can tell you? Usually: a result
with no number in it, the most relevant work missing or described in one
vague line, or nothing that shows they can do the target role.

Rules:
- Never ask for something that is already in the profile.
- Never ask for a phone number, an email, a photo or anything personal.
- Never ask about duplicates, formatting, dates or wording: tidying the
  profile is our job, not theirs. Ask only for what only they know.
- Each question is one short sentence they can answer in a line, about their
  own work, in their field's terms. Name the thing you mean ("the checkout
  rebuild at Acme"), never "your experience".
- When it is already good for where they are, ask nothing. Two questions is a
  ceiling, not a target.

Return this object and nothing else:
{ "questions": ["...", "..."] }`;

/**
 * Suggested answers for a question the page is about to ask: job titles,
 * the role they want next, or their skills, written for this person.
 */
const SUGGEST_KINDS = {
  titles: 'job titles that fit them, as a recruiter would search them, including their level where a title carries one ("Senior Frontend Engineer")',
  targets: 'roles they could realistically aim for next, as job titles, from a natural next step to a stretch',
  skills: 'skills a recruiter would filter on for their work: tools, languages, methods and specialisms, each one or two words, most specific first',
};

const saidBlock = (said = []) => (said.length
  ? `═══ WHAT THEY SAID, IN THEIR OWN WORDS (oldest first) ═══
${said.map((line) => `- ${JSON.stringify(line)}`).join('\n')}

`
  : '');

const suggestPrompt = ({ profile, kind, question, said = [] }) => `You write the suggested answers shown as buttons under a question in a career coach's conversation.

${stageGuidance(profile)}

═══ WHAT WE KNOW ABOUT THEM ═══
${JSON.stringify(profile, null, 2)}

${saidBlock(said)}═══ THE QUESTION ═══
"${question}"

Write 4 to 6 ${SUGGEST_KINDS[kind] || SUGGEST_KINDS.titles}.
Base them on what they told us. Their own words come first: a role, a tool or
a goal they named ("I want to be a data scientist") outranks the broad field
they picked, so every button is about that, never a neighbouring speciality
they did not mention. Then their level, career stage, title, roles and
projects. Specific beats generic: for a frontend engineer, "React" and
"TypeScript", not "Programming". Never repeat something already in their
profile as a skill. Each one at most 40 characters.

Return this object and nothing else:
{ "suggestions": ["...", "..."] }`;

module.exports = { stageOf, stageGuidance, gapCheckPrompt, suggestPrompt, SUGGEST_KINDS };
