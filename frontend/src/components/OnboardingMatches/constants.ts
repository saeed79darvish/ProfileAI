// Enough to feel like a real result, few enough to read without scrolling.
export const MAX_JOBS = 4;

export const TEXT = {
  TITLE: 'We found jobs that match you',
  SUB: 'Picked for the profile you just built. Open one to see the details, tailor your resume and apply.',
  // When the coach showed them jobs before sign-up: those, now scored.
  PICKS_TITLE: 'Your jobs, with your match score',
  PICKS_SUB: 'The jobs from the end of your profile, scored against it. Open one to tailor your resume and apply.',
  SCORING: 'Scoring your match...',
  LOADING: 'Finding your matches...',
  SEE_ALL: 'See all matches',
  LATER: 'Maybe later',
  CLOSE: 'Close',
  POSTED_TODAY: 'Today',
  POSTED_YESTERDAY: 'Yesterday',
  POSTED_DAYS: (n: number) => `${n}d ago`,
  WORK_TYPE: { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' } as Record<string, string>,
};
