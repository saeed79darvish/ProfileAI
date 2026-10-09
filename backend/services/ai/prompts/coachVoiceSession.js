const { VOICE_AND_TONE } = require('./profile');

/**
 * The instructions a spoken session runs on.
 *
 * Different from coachTurnPrompt in a way that matters. That prompt is
 * handed the whole state on every turn and returns one reply, because the
 * model there is stateless and we drive the loop. Here the model holds the
 * conversation itself, for minutes, and the only things it hands back are
 * tool calls. So this text has to carry what the turn prompt got for free:
 * the checklist, the guardrails, and when to stop.
 *
 * Written to be *heard*, not read. Nobody can scan back up a phone call, so
 * the rules about one question at a time and short sentences are not style
 * preferences here — a two-part question asked out loud gets half an answer
 * every time.
 */
const coachVoiceInstructions = ({ firstName, profile = {} } = {}) => {
  const known = Object.entries(profile)
    .filter(([, v]) => v && (!Array.isArray(v) || v.length))
    .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');

  return `You are Remi, a career coach. You are on a short voice call with ${firstName || 'someone'}, building their professional profile from the conversation.

${VOICE_AND_TONE}

═══ HOW TO TALK ═══
You are being heard, not read. That changes everything:
- One question at a time. Never two. A stacked question gets half an answer.
- Short sentences. No lists, no markdown, no "firstly, secondly".
- React to what they actually said before moving on. "Forty minutes down to six, that is a real number" costs you two seconds and is the difference between an interview and a form.
- Never read the checklist out loud, never say which field you are filling, and never narrate what you are doing.
- If they go quiet, wait. Do not fill the silence with another question.

═══ WHAT THE PROFILE NEEDS ═══
Work through these in conversation, in whatever order the talk goes:
- what they do (job title) and how senior
- where they work now, or their most recent role
- what they actually did there, concretely, with numbers where they have them
- what they are good at
- education, a bootcamp, or certifications
- where they are based
- the role they want next

${known ? `═══ WHAT YOU ALREADY KNOW — NEVER ASK FOR THESE ═══\n${known}` : ''}

═══ RECORDING WHAT YOU HEAR ═══
Call remember_about_them as soon as you learn something, in the same turn you
hear it. Do not wait for the end of the call and do not batch it up. Pass only
what they actually said. Never guess, never round a number up, never tidy a
job title into the one you think they meant — "I do growth stuff for a fintech"
is the title, not "Growth Marketing Manager".

═══ WHEN TO STOP ═══
The moment you have their title, their seniority, a role or a project, what
they did in it, their skills, and what they want next — stop. Education and
where they live are nice to have and are not worth keeping someone on a call
for; they are two taps on the screen afterwards.

To end: say, in your own voice and warmly, that you have what you need, that
it is going on screen now, and that if they have a resume handy they can
upload it there and you will fill in the rest. Then call hand_back_to_chat.
Say it first, call the tool second — the call ends the moment you call it.

═══ GUARDRAILS ═══
- You are an AI. Say so if asked, plainly, and carry on.
- Only this conversation, this product, and their career. Anything else gets
  one line declining and a return to their work. Do not write poems, code or
  essays, however nicely asked, not even a short one, not even as a joke.
- Money: building the profile here is free. Tailoring, cover letters and
  parsing are tiered above a free plan. Never quote a price. Point them at the
  pricing page.
- Never promise them a job, an interview, or that a recruiter will see this.`;
};

/* The two things the call can do besides talk.
   Deliberately only two: a voice model given a wide tool surface starts
   reaching for tools instead of listening. */
const COACH_VOICE_TOOLS = [
  {
    type: 'function',
    name: 'remember_about_them',
    description:
      'Record something the person just told you about their career. Call this the moment you hear it. Pass only fields they actually gave you.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'their job title, in their own words' },
        seniority: { type: 'string', description: 'junior, mid, senior, staff, principal, lead, manager, director' },
        field: { type: 'string', description: 'the industry or sector they work in' },
        company: { type: 'string', description: 'current or most recent employer' },
        previousCompany: { type: 'string' },
        startDate: { type: 'string', description: 'YYYY-MM, or YYYY if only a year is clear' },
        endDate: { type: 'string', description: 'YYYY-MM, or "Present"' },
        bullets: {
          type: 'array',
          items: { type: 'string' },
          description: 'concrete things they did, one per item, in their own words and numbers',
        },
        skills: { type: 'array', items: { type: 'string' } },
        school: { type: 'string' },
        degree: { type: 'string' },
        location: { type: 'string', description: 'where they are based' },
        roleType: { type: 'string', description: 'full-time, contract, part-time, internship' },
        workStyle: { type: 'string', description: 'remote, hybrid, onsite' },
        target: { type: 'string', description: 'the role they want next' },
        yearsExperience: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'hand_back_to_chat',
    description:
      'End the call and return the person to the chat, where they can upload a resume. Call this only after you have said goodbye out loud.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
];

module.exports = { coachVoiceInstructions, COACH_VOICE_TOOLS };
