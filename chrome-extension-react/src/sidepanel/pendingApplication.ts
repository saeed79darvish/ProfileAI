/**
 * Pure helpers for the "Did you apply?" card: comparing the page the person is
 * on with a tracked application, and saying how long ago it was started.
 */

const TRACKING_PARAM = /^(utm_.*|gh_src|gh_jid_src|ref|refid|referrer|source|src|fbclid|gclid|mc_.*|trk|trackingid|lipi|midtoken)$/i;

/** Lowercased host (no www), no hash, no trailing slash, tracking params dropped, rest sorted. */
export function normalizeJobUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const u = new URL(raw.trim());
    const kept: Array<[string, string]> = [];
    u.searchParams.forEach((v, k) => {
      if (!TRACKING_PARAM.test(k)) kept.push([k, v]);
    });
    kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
    const query = kept.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '');
    return `${host}${path}${query ? `?${query}` : ''}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

export function sameJobUrl(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizeJobUrl(a);
  return !!x && x === normalizeJobUrl(b);
}

export interface PendingApplication {
  id: string;
  jobTitle: string;
  company: string;
  jobUrl?: string | null;
  status?: string;
  startedAt?: string | null;
  lastActivityAt?: string | null;
}

/** First pending application whose job is not the page the person is on. */
export function pickPending(list: PendingApplication[] | null | undefined, currentUrl: string | null | undefined): PendingApplication | null {
  if (!Array.isArray(list)) return null;
  for (const p of list) {
    if (!p || !p.id || !p.jobTitle) continue;
    if (currentUrl && sameJobUrl(p.jobUrl, currentUrl)) continue;
    return p;
  }
  return null;
}

/** "just now", "35 minutes ago", "2 hours ago", "yesterday", "3 days ago", "2 weeks ago". */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return 'earlier';
  const mins = Math.max(0, Math.floor((now - t) / 60000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? '1 month ago' : `${months} months ago`;
}
