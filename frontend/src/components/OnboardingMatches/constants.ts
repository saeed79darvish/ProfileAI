// Enough to feel like a real result, few enough to read without scrolling.
export const MAX_JOBS = 4;

export const TEXT = {
  TITLE: 'We found jobs that match you',
  SUB: 'Picked for the profile you just built. Open one to see the details, tailor your resume and apply.',
  LOADING: 'Finding your matches...',
  SEE_ALL: 'See all matches',
  LATER: 'Maybe later',
  CLOSE: 'Close',
  POSTED_TODAY: 'Today',
  POSTED_YESTERDAY: 'Yesterday',
  POSTED_DAYS: (n: number) => `${n}d ago`,
  WORK_TYPE: { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' } as Record<string, string>,
};
