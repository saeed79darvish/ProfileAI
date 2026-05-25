// Utils for CandidateJobs

export const formatSalary = (min: number | null, max: number | null, currency = 'USD') => {
  const formatNum = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return num;
  };

  if (min && max) {
    return `${currency} ${formatNum(min)} - ${formatNum(max)}`;
  } else if (min) {
    return `${currency} ${formatNum(min)}+`;
  } else if (max) {
    return `Up to ${currency} ${formatNum(max)}`;
  }
  return 'Competitive';
};

export const formatTimeAgo = (date: string | Date | null | undefined) => {
  // Guard against undefined / null / unparsable dates, without this,
  // `new Date(undefined).getTime()` is NaN and we end up rendering
  // strings like "NaN months ago".
  if (!date) return '';
  const posted = new Date(date);
  if (Number.isNaN(posted.getTime())) return '';

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - posted.getTime());
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  // Anything older than a year, show the year so "December last year" doesn't
  // collapse to "13 months ago" etc. Useful for stale postings.
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
};

/**
 * Formats a job's posting time with an honest label.
 * - `postedAt` (from the source ATS) → "Posted X ago".
 * - `createdAt` fallback (when we first saw the job) → "Listed X ago".
 *   Some legacy rows have no postedAt; rather than hide them, label
 *   them honestly.
 */
export const formatJobPostedTime = (job: { postedAt?: string | Date | null; createdAt?: string | Date | null }) => {
  if (job?.postedAt) {
    const t = formatTimeAgo(job.postedAt);
    return t ? `Posted ${t}` : '';
  }
  if (job?.createdAt) {
    const t = formatTimeAgo(job.createdAt);
    return t ? `Listed ${t}` : '';
  }
  return '';
};
