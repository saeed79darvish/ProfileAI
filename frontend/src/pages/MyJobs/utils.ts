// Utils for MyJobs
import { COMPANY_COLORS, TIMINGS, LIMITS } from './constants';

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / TIMINGS.MS_PER_DAY);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < LIMITS.DAY_THRESHOLD) return `${diffDays}d ago`;
  if (diffDays < LIMITS.WEEK_THRESHOLD) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getCompanyInitial(company: string | null | undefined): string {
  return company ? company.charAt(0).toUpperCase() : '?';
}

export function getCompanyColor(company: string | null | undefined): { color: string; bg: string } {
  const idx = (company || '').charCodeAt(0) % COMPANY_COLORS.length;
  return COMPANY_COLORS[idx];
}
