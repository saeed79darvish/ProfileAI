export const ROUTES = {
  PROFILE: (id: string | number) => `/profile/${id}`,
  MESSAGES: (userId: string | number) => `/messages?userId=${userId}`,
  CALENDAR: '/recruiter/calendar',
} as const;

export const TEXT = {
  LOADING: 'Loading interview results...',
  PAGE_TITLE: 'AI Interview Results',
  STAT_COMPLETED: 'Completed Screenings',
  STAT_PENDING: 'Pending',
  STAT_AVG_SCORE: 'Avg. Score',
  STAT_RECOMMENDED: 'Recommended',
  TAB_COMPLETED: 'Completed',
  TAB_PENDING: 'Pending',
  TAB_ALL: 'All',
  SEARCH_PLACEHOLDER: 'Search by candidate or job...',
  FILTER_ALL: 'All Statuses',
  EMPTY_TITLE: 'No Interview Results',
  EMPTY_COMPLETED: 'No completed AI screenings yet. Results will appear here once candidates complete their phone screenings.',
  EMPTY_PENDING: 'No pending screenings at the moment.',
  EMPTY_ALL: 'No interviews found matching your criteria.',
  AI_SUMMARY: 'AI Summary',
  STRENGTHS: 'Strengths',
  CONCERNS: 'Areas of Concern',
  TRANSCRIPT_TITLE: 'Full Conversation Transcript',
  SPEAKER_AI: 'AI Recruiter',
  SPEAKER_CANDIDATE: 'Candidate',
  NO_TRANSCRIPT: 'No transcript available',
  SHOW_LESS: 'Show Less',
  SHOW_MORE: 'Show More Details',
  VIEW_PROFILE: 'View Full Profile',
  SEND_MESSAGE: 'Send Message',
  SCHEDULE_FOLLOWUP: 'Schedule Follow-up',
  MOVE_NEXT_ROUND: 'Move to Next Round',
  REJECT: 'Reject',
  INTERVIEW_STATUS: 'Interview Status',
  VIEW_PROFILE_SHORT: 'View Profile',
  CONTACT_CANDIDATE: 'Contact Candidate',
  STATUS_SCHEDULED: 'AI phone screening scheduled for',
  STATUS_IN_PROGRESS: 'AI is currently conducting the phone screening...',
  STATUS_FAILED: 'The call could not be completed. Consider rescheduling.',
  STATUS_NO_ANSWER: 'Candidate did not answer. You may want to reschedule.',
  STATUS_NONE: 'No AI phone screening has been scheduled for this interview.',
} as const;

export const RECOMMENDATION_MAP: Record<string, string> = {
  strongly_recommend: 'Strongly Recommend',
  recommend: 'Recommend',
  consider: 'Consider',
  not_recommended: 'Not Recommended',
  pending: 'Pending',
};

export const STATUS_MAP: Record<string, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  scheduled: 'Scheduled',
  failed: 'Failed',
  no_answer: 'No Answer',
};

export const THRESHOLDS = {
  COLLAPSED_ITEMS: 3,
  NEXT_ROUND_SCORE: 70,
  REJECT_SCORE: 50,
} as const;
