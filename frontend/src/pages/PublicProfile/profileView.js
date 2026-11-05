// Shared by the phone and desktop public profile layouts.

export const ROLE_COLORS = ['#6366f1', '#ea7a1f', '#3b82f6', '#10b981', '#a855f7'];

export const initialsOf = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
/** "Senior UI Engineer (React, Node)" reads as "Senior UI Engineer". */
export const cleanRoleTitle = (t) => String(t || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
export const splitBullets = (text) => String(text || '').split('\n').map((l) => l.replace(/^\s*[•\-*–]\s*/, '').trim()).filter(Boolean);
/** Bullets with a figure in them lead; the rest keep their order. */
export const strongestFirst = (bullets) => [...bullets.filter((b) => /\d/.test(b)), ...bullets.filter((b) => !/\d/.test(b))];
export const isCurrent = (e) => e.current === true || !e.endDate || /present|current/i.test(String(e.endDate));

const isWebUrl = (s) => {
  if (!s || typeof s !== 'string') return false;
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
};
/** The project's live link, else its repo. */
export const projectLink = (p) => (isWebUrl(p.url) ? p.url : isWebUrl(p.githubUrl) ? p.githubUrl : '');
export const projectTechs = (p) => (Array.isArray(p.technologies)
  ? p.technologies.filter(Boolean)
  : typeof p.technologies === 'string' ? p.technologies.split(',').map((t) => t.trim()).filter(Boolean) : []);
