/* Answer memory: the facts and stories the coach can collect so that
   application questions are answered the way the person would.

   The server owns the real catalog (GET /api/career-context/answer-catalog).
   This is a small static copy of the part the coach asks, used for guests who
   cannot call authed endpoints and as the fallback when the fetch fails.
   KEEP IN SYNC with the backend catalog: ids, choice values and the order of
   usefulness. Ids and choice values must match exactly, the extension and
   generate-answers read them. Backend source: the module behind
   GET /api/career-context/answer-catalog (backend/config/answerCatalog.js).

   Never add demographic questions here (gender, race, veteran, disability,
   age, religion, orientation, criminal history). They are never asked or stored. */

export const ANSWER_MEMORY_INTRO = 'A few quick questions so I can answer application questions the way you would. This stays private. We never share it, and we only use it to answer the custom questions on your applications.';
export const ANSWER_PRIVACY_LINE = 'This stays private. We never share it, and we only use it to answer the custom questions on your applications.';

// The most useful first. At most MAX_FACTS facts and MAX_STORIES stories are asked.
export const MEMORY_FACT_IDS = ['workAuthorization', 'openToRelocation', 'officeComfort', 'earliestStart', 'salaryExpectation'];
export const MEMORY_STORY_IDS = ['motivation', 'proudestAchievement'];
export const MAX_FACTS = 5;
export const MAX_STORIES = 2;

export const STATIC_ANSWER_CATALOG = {
  facts: [
    {
      id: 'workAuthorization',
      label: 'Work authorization',
      ask: 'Do you need a company to sponsor your work visa, now or later?',
      type: 'choice',
      choices: [
        { value: 'authorized_no_sponsorship', label: 'No, I can work here without sponsorship' },
        { value: 'needs_sponsorship_now', label: 'Yes, I need sponsorship now' },
        { value: 'needs_sponsorship_future', label: 'Not now, but I will later' },
      ],
    },
    {
      id: 'openToRelocation',
      label: 'Open to relocating',
      ask: 'Would you move for the right job?',
      type: 'choice',
      choices: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'depends', label: 'It depends' },
      ],
    },
    {
      id: 'officeComfort',
      label: 'Office comfort',
      ask: 'How do you feel about going into an office?',
      type: 'choice',
      choices: [
        { value: 'remote_only', label: 'Remote only' },
        { value: 'hybrid_ok', label: 'Hybrid is fine' },
        { value: 'onsite_ok', label: 'On-site is fine' },
      ],
    },
    {
      id: 'earliestStart',
      label: 'Earliest start date',
      ask: 'When could you start a new job? A date or something like "two weeks" works.',
      type: 'text',
    },
    {
      id: 'noticePeriod',
      label: 'Notice period',
      ask: 'How much notice do you have to give your current employer?',
      type: 'text',
    },
    {
      id: 'salaryExpectation',
      label: 'Salary expectation',
      ask: 'What pay are you looking for? A range is fine.',
      type: 'text',
    },
  ],
  stories: [
    {
      id: 'motivation',
      label: 'What motivates you',
      ask: 'In a sentence or two, what draws you to the work you do?',
    },
    {
      id: 'proudestAchievement',
      label: 'Proudest achievement',
      ask: 'What is something you did at work that you are proud of?',
    },
  ],
};
