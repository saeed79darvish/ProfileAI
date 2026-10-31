// Three rows of two on a laptop: a real choice, still readable without
// scrolling far.
export const MAX_JOBS = 6;

export const TEXT = {
  LIVE: 'Hiring now',
  // Not "the profile you just built": this also opens after any sign-in.
  TITLE: 'Your best job matches right now',
  SUB: 'Picked for your profile. Open one to see the details, tailor your resume with AI and apply.',
  // When the coach showed them jobs before sign-up: those, now scored.
  PICKS_TITLE: 'Your jobs, with your match score',
  PICKS_SUB: 'The jobs from the end of your profile, scored against it, then more that fit. Open one to tailor your resume and apply.',
  SCORING: 'Scoring your match...',
  LOADING: 'Finding your matches...',
  YOU_HAVE: 'You have',
  OPEN: 'View and apply',
  SEE_ALL: 'See all matches',
  LATER: 'Maybe later',
  CLOSE: 'Close',
  POSTED_TODAY: 'Posted today',
  POSTED_YESTERDAY: 'Posted yesterday',
  POSTED_DAYS: (n: number) => `Posted ${n}d ago`,
  WORK_TYPE: { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' } as Record<string, string>,
};
