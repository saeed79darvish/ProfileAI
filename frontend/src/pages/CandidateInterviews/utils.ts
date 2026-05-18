// Utils for CandidateInterviews

export const formatPhoneNumber = (phone: string | null) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    return `+1 (${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
  }

  return phone;
};

export const formatDateTime = (datetime: string | Date) => {
  const date = new Date(datetime);
  return {
    date: date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')
  };
};

export const getEffectiveStatus = (interview: any) => {
  const callStatus = interview.phoneScreening?.status;

  if (callStatus === 'completed') return 'interviewed';
  if (callStatus === 'in_progress' || callStatus === 'ringing') return 'in_call';
  if (callStatus === 'failed' || callStatus === 'no_answer' || callStatus === 'busy' || callStatus === 'voicemail') return 'call_failed';
  if (interview.status === 'rescheduled') return 'needs_reschedule';

  return interview.status;
};

export const isInterviewTimePassed = (interview: any) => {
  if (!interview.scheduledAt) return false;
  const scheduledTime = new Date(interview.scheduledAt);
  const now = new Date();
  return now > scheduledTime;
};

export const getTimeUntilInterview = (scheduledAt: string | null) => {
  if (!scheduledAt) return null;
  const now = new Date();
  const scheduled = new Date(scheduledAt);
  const diff = scheduled.getTime() - now.getTime();

  if (diff <= 0) return null;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} min`;
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
};

export const getTimeSinceScheduled = (scheduledAt: string | null) => {
  if (!scheduledAt) return { text: null, hoursAgo: 0 };
  const now = new Date();
  const scheduled = new Date(scheduledAt);
  const diff = now.getTime() - scheduled.getTime();

  if (diff <= 0) return { text: null, hoursAgo: 0 };

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  let text;
  if (days > 0) text = `${days} day${days > 1 ? 's' : ''} ago`;
  else if (hours > 0) text = `${hours} hour${hours > 1 ? 's' : ''} ago`;
  else text = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

  return { text, hoursAgo: hours, daysAgo: days };
};
