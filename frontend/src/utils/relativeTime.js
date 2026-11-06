/**
 * "just now", "12 minutes ago", "3 hours ago", "yesterday", "5 days ago".
 * Pure: `now` is passed in so it can be tested.
 */
export function relativeTimeAgo(from, now = Date.now()) {
  const t = from instanceof Date ? from.getTime() : new Date(from).getTime();
  if (!Number.isFinite(t)) return 'earlier';
  const mins = Math.floor(Math.max(0, now - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  return 'over a year ago';
}
