// Profile completeness + lightweight returning-user summary.
// Used by the signed-out reconnect screen and the logged-in setup guide.
import type { FullProfile, User } from '../types';

export interface ProfileSummary {
  /** Single uppercase initial for the avatar. */
  initial: string;
  firstName: string;
  title: string;
  /** Profile strength 0-100. */
  strength: number;
  /** A few skill chips to preview. */
  skills: string[];
  /** When this summary was last refreshed (epoch ms). */
  lastActive: number;
}

export interface ChecklistItem {
  key: string;
  label: string;
  sublabel: string;
  done: boolean;
}

export interface ProfileProgress {
  percent: number;
  items: ChecklistItem[];
  /** True once the profile has enough to do match scoring (role + skills). */
  hasMinimumProfile: boolean;
}

// Flatten skills from any stored format (array / object-by-category / string).
function flattenSkills(skills: unknown): string[] {
  if (!skills) return [];
  if (Array.isArray(skills)) {
    return skills
      .map((s: any) => (typeof s === 'string' ? s : s?.name || s?.skill || ''))
      .filter(Boolean);
  }
  if (typeof skills === 'string') {
    return skills.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (typeof skills === 'object') {
    const all: string[] = [];
    for (const category of Object.values(skills as Record<string, unknown>)) {
      if (Array.isArray(category)) {
        category.forEach((s: any) => {
          const name = typeof s === 'string' ? s : s?.name || s?.skill || '';
          if (name) all.push(name);
        });
      } else if (typeof category === 'string') {
        all.push(category);
      }
    }
    return all;
  }
  return [];
}

// Weights chosen so an account-only profile reads ~10% and a fully filled one hits 100%.
const WEIGHTS = { account: 10, role: 25, skills: 25, contact: 15, experience: 25 };

export function computeProfileProgress(profile: FullProfile | null): ProfileProgress {
  const skills = flattenSkills(profile?.skills);
  const hasRole = !!(profile?.title || profile?.headline);
  const hasSkills = skills.length > 0;
  const hasContact = !!(profile?.phone || profile?.location);
  const hasExperience = Array.isArray(profile?.experience) && (profile!.experience!.length > 0);

  let percent = WEIGHTS.account;
  if (hasRole) percent += WEIGHTS.role;
  if (hasSkills) percent += WEIGHTS.skills;
  if (hasContact) percent += WEIGHTS.contact;
  if (hasExperience) percent += WEIGHTS.experience;

  const items: ChecklistItem[] = [
    { key: 'account', label: 'Account created', sublabel: '', done: true },
    { key: 'role', label: 'Add your role & industry', sublabel: 'Unlocks job match scoring', done: hasRole },
    { key: 'skills', label: 'Add skills', sublabel: 'Unlocks ATS gap analysis', done: hasSkills },
    { key: 'contact', label: 'Add contact info', sublabel: 'Unlocks Quick Fill Basics', done: hasContact },
    { key: 'experience', label: 'Add work experience', sublabel: 'Unlocks Cover Letter AI', done: hasExperience },
  ];

  return { percent, items, hasMinimumProfile: hasRole && hasSkills };
}

// Build a small, non-sensitive summary persisted across logout so returning
// users see the "reconnect" screen instead of a blank sign-in form.
export function buildProfileSummary(
  profile: FullProfile | null,
  user: User | null
): ProfileSummary | null {
  if (!profile) return null;
  const firstName = profile.firstName || user?.firstName || '';
  const title = profile.title || profile.headline || '';
  const skills = flattenSkills(profile.skills).slice(0, 6);
  // Only worth a reconnect screen if there's something to come back to.
  if (!title && skills.length === 0) return null;
  const { percent } = computeProfileProgress(profile);
  return {
    initial: (firstName[0] || profile.email?.[0] || user?.email?.[0] || '?').toUpperCase(),
    firstName,
    title,
    strength: percent,
    skills,
    lastActive: Date.now(),
  };
}

export function formatLastActive(ts: number): string {
  const diff = Date.now() - ts;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return 'today';
  const days = Math.floor(diff / day);
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  return 'a while ago';
}
