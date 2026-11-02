/**
 * coachAgent — what the coach can do on the page, not just say.
 *
 * The typed coach used to return two flags ("voice", "show") and the page
 * acted on them if it could. When it could not, nobody told the model: a
 * guest who closed a call and typed "lets talk" was told "I can't do a full
 * voice call here", a minute after having one. Now each thing it can do is a
 * tool. The tool checks what would really happen (the server's own voice
 * check, whether they are signed in, which answers can be taken back) and
 * says so, and the model writes its reply from that result.
 *
 * The tools only record what the page should do (`actions`); the page does
 * it. The question ladder stays the page's: none of these ask a question.
 */

/* What ProfilleAI does, as the coach may describe it. Read from the code
   (routes, plan limits in config/aiLimits.js), not from marketing copy, and
   kept to what is switched on for everyone: recruiter search, ApplyPilot and
   the Claude connector are behind flags and are left out. Limits are the
   Free plan's; never prices. */
const FEATURES = {
  coach: {
    what: 'This conversation. You build their profile with them by chat, by importing a resume or LinkedIn, or by talking. Free and unlimited, and no account is needed to start.',
    access: 'Anyone, at /profile/create. A guest is asked for a free account at the end to save and publish it.',
  },
  voice_call: {
    what: 'A live spoken conversation with you, Remi, inside this page. You hear them, answer and fill in the profile as they talk.',
    access: 'Guests: one call a day of up to 5 minutes. A call closed within a minute with nothing said is given back. A free account includes one call of up to 10 minutes; Pro and Pro+ include monthly call time.',
  },
  dictation: {
    what: 'The mic in the text box. They speak and their words are written into the box; it never sends on its own.',
    access: 'Anyone, free, on every plan.',
  },
  public_profile: {
    what: 'When their profile is published they get a public profile page with its own link to share, and anyone with the link can download it as a PDF resume.',
    access: 'Needs a free account (made at the end of this conversation).',
  },
  profile_editor: {
    what: 'A form to edit every part of the profile after this conversation, at /profile/edit, opened from Edit Profile on their dashboard.',
    access: 'Needs a free account. Free.',
  },
  jobs: {
    what: 'A job board at /jobs with search and filters, and a match score on each job against their profile.',
    access: 'Anyone can browse. Saving jobs, the match score and the AI job tools need a free account. The match score is unlimited on every plan.',
  },
  tailor_resume: {
    what: 'Tailor for a Job: they paste a posting or open one, see how they match, confirm skills it could not find, and get a tailored copy of their resume for that job. Their main profile is never changed.',
    access: 'Needs a free account. Free plan: 3 tailored resumes in total; Pro and Pro+ include more each month. From the dashboard, the jobs page, or a job page.',
  },
  cover_letter: {
    what: 'Writes a cover letter for a specific job, with tone and length options, from the AI tools on the jobs page or a job page.',
    access: 'Needs a free account. Free plan: 2 a month; Pro and Pro+ include more.',
  },
  extension: {
    what: 'A Chrome extension that fills in job application forms, drafts answers to screening questions and tailors their resume on job sites like LinkedIn, Greenhouse and Workday. Details and install at /extension.',
    access: 'Using it needs a free account. Free plan: 5 autofills a month; unlimited on Pro and Pro+.',
  },
  resume_download: {
    what: 'Download their resume, or a tailored copy, as a PDF or Word file from their dashboard.',
    access: 'Needs a free account. Free on every plan; files on the Free plan carry a small "Made with ProfilleAI" line.',
  },
  about_you: {
    what: 'A page at /profile/about-you showing what the coach keeps beyond the resume: their target role, why and what is in the way, what they are looking for, and a short summary of each call (no recordings or transcripts). Every item can be edited or deleted. Only they see it.',
    access: 'Needs a free account.',
  },
  plans: {
    what: 'Plans are Free, Pro and Pro+, plus credit packs. Building the profile is free on all of them. The paid plans add more tailored resumes, cover letters, autofills and call time. Prices are on /pricing.',
    access: 'Anyone can see /pricing. Never quote a price.',
  },
};
const FEATURE_IDS = Object.keys(FEATURES);

const noInput = { type: 'object', properties: {}, additionalProperties: false };

/* Only the answers the page can take back are offered, so go_back is left
   out entirely when there are none. */
function coachTools(state = {}) {
  const answered = (state.answered || []).map((a) => a.step);
  const tools = [
    {
      name: 'start_voice_call',
      description: 'Open a live voice call with you, the same as the Talk it through button. The result says whether it can open; do what it says.',
      input_schema: noInput,
    },
    {
      name: 'offer_import',
      description: 'Put Upload my resume and Import from LinkedIn buttons under your reply. A file dialog cannot be opened for them: they tap one.',
      input_schema: noInput,
    },
    {
      name: 'offer_account',
      description: 'Put Create my free account and I already have an account buttons under your reply. What they have so far is kept.',
      input_schema: {
        type: 'object',
        properties: {
          reason: { type: 'string', enum: ['voice', 'save'], description: 'voice: they want a call and today\'s is used. save: they want to save, sign up or finish later.' },
        },
        required: ['reason'],
        additionalProperties: false,
      },
    },
    {
      name: 'look_up_feature',
      description: 'Facts about one ProfilleAI feature: what it does, who can use it and where. Use before answering anything about what ProfilleAI can do.',
      input_schema: {
        type: 'object',
        properties: { feature: { type: 'string', enum: FEATURE_IDS } },
        required: ['feature'],
        additionalProperties: false,
      },
    },
  ];
  if (answered.length) {
    tools.push({
      name: 'go_back',
      description: 'Take back one of their earlier button answers when they say it was wrong, and ask that question again. Answers after it that depended on it are asked again too.',
      input_schema: {
        type: 'object',
        properties: { step: { type: 'string', enum: answered } },
        required: ['step'],
        additionalProperties: false,
      },
    });
  }
  return tools;
}

const ONE_LINE = 'Make "say" one short line and ask nothing: the page does the rest.';

/* `access`: { signedIn, voice } from the server. `state`: the page's own
   account of itself, already cleaned (profileCoachService.cleanState). */
function createToolRunner({ access = {}, state = {} } = {}) {
  const actions = [];
  // One thing goes under the reply: a call and a row of buttons at once is two answers.
  const act = (action, result) => {
    if (actions.length) {
      return { done: false, why: `Something is already going under your reply (${actions[0].type}). One per turn.` };
    }
    actions.push(action);
    return result;
  };

  const run = (name, input = {}) => {
    switch (name) {
      case 'start_voice_call':
        if (access.voice === 'can_call') {
          return act({ type: 'voice' }, { done: true, what: 'The call opens straight after your reply.', next: 'Make "say" one short line agreeing, like "Sure, let\'s talk.", and ask nothing.' });
        }
        if (access.voice === 'guest_call_used') {
          return {
            done: false,
            why: "Today's free call on this device has been used.",
            next: access.signedIn
              ? 'Point them at the mic in the text box in one line, and carry on.'
              : 'Call offer_account with reason "voice", and say in one line that a free account includes a call and keeps everything so far. The mic in the text box works meanwhile.',
          };
        }
        if (access.voice === 'plan_limit') {
          return { done: false, why: 'Their plan has no call time left for now.', next: 'Say so in one line, mention the mic in the text box still works, and carry on. Plans are on /pricing.' };
        }
        return { done: false, why: 'Live calls are not running right now.', next: 'Point them at the mic in the text box in one line and carry on.' };

      case 'offer_import':
        return act({ type: 'import' }, { done: true, what: 'Upload my resume and Import from LinkedIn buttons are under your reply.', next: `${ONE_LINE} Do not explain the steps.` });

      case 'offer_account':
        if (access.signedIn) {
          return { done: false, why: 'They are already signed in, and everything saves to their account as they go.' };
        }
        return act(
          { type: 'account', reason: input.reason === 'voice' ? 'voice' : 'save' },
          { done: true, what: 'Create my free account and I already have an account buttons are under your reply. What they have so far is kept.', next: ONE_LINE }
        );

      case 'go_back': {
        const found = (state.answered || []).find((a) => a.step === input.step);
        if (!found) return { done: false, why: 'That answer cannot be taken back from here.', next: 'Tell them they can change it in the editor at the end.' };
        return act({ type: 'rewind', step: found.step }, {
          done: true,
          what: `Their answer "${found.answer}" is taken back, and "${found.question}" is asked again with its buttons right after your reply.`,
          next: `${ONE_LINE} Put nothing in "learned" for it.`,
        });
      }

      case 'look_up_feature': {
        const feature = FEATURES[input.feature];
        if (!feature) return { found: false, known: FEATURE_IDS };
        return { found: true, ...feature };
      }

      default:
        return { done: false, why: `There is no tool called ${name}.` };
    }
  };

  return { run, actions };
}

module.exports = { coachTools, createToolRunner, FEATURES, FEATURE_IDS };
