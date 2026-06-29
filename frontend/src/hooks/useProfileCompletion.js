import { useMemo } from 'react';

/**
 * Single source of truth for profile-completion scoring.
 *
 * Used by:
 *   - ProfileForm sidebar          (post-save editor view)
 *   - Dashboard ProfileCompletionCard (re-entry view)
 *   - ProfileCelebration success modal (passes the result as a prop)
 *   - JobPreferencesWizard meter   (via wizardDataToProfileShape adapter)
 *
 * Rubric — 9 items, equal weight (~11.11% each). Empty input gives 0%.
 *
 *   ┌─────────────┬───────────────────────────────────────────────────────┐
 *   │ key         │ done when…                                            │
 *   ├─────────────┼───────────────────────────────────────────────────────┤
 *   │ title       │ profile.title (or .headline) is a real string         │
 *   │ summary     │ profile.summary is real AND ≥ 20 characters           │
 *   │ location    │ profile.location is a real string                     │
 *   │ photo       │ profile.profilePicture is truthy                      │
 *   │ links       │ profile.linkedinUrl OR profile.githubUrl is real      │
 *   │ skills      │ ≥ 1 real skill (across all categories if keyed)       │
 *   │ exp         │ ≥ 1 experience row with company, title, AND a date    │
 *   │ edu         │ ≥ 1 education row with institution AND degree         │
 *   │ proj        │ ≥ 1 project row with title AND description            │
 *   └─────────────┴───────────────────────────────────────────────────────┘
 *
 *   "Real" means non-empty AND not a placeholder like "field" / "degree" /
 *   "n/a" — see PLACEHOLDER_RE below.
 *
 * Tiers (the same numbers everywhere):
 *
 *   pct ≥ 80   →  Advanced     (green   #16a34a)
 *   pct ≥ 50   →  Intermediate (amber   #f59e0b)
 *   pct <  50  →  Beginner     (slate   #94a3b8)
 *
 * Accepts a profile-like object. `skills` may be either an object keyed by
 * category (each an array) or a flat array — both shapes are handled, which
 * is what lets the wizard (flat array) and the editor (keyed object) score
 * against the same function.
 *
 * Returns: { pct, label, color, score, total, items, missing, done }
 *   - items:   full checklist with { key, section, label, action, gainPct, done }
 *   - missing: subset of items where done === false
 */

const PLACEHOLDER_RE = /^(field|degree|period|company\s*name|institution\s*name|role|title|n\/?a|none|null|undefined|tbd)$/i;

const isReal = (v) => {
  if (v == null) return false;
  const s = String(v).trim();
  if (!s) return false;
  return !PLACEHOLDER_RE.test(s);
};

const hasRealEntry = (entry, requiredKeys) =>
  !!entry && requiredKeys.every((k) => isReal(entry[k]));

const flattenSkills = (skills) => {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills;
  if (typeof skills === 'object') return Object.values(skills).flat();
  return [];
};

/**
 * Canonical rubric. Exported so tests + downstream UIs can introspect it
 * (e.g. an analytics event "first time hit Advanced tier"). Keep in sync
 * with the table in the leading comment above.
 */
export const COMPLETION_RUBRIC = Object.freeze([
  { key: 'title',    section: 'basic',      label: 'Add a professional title' },
  { key: 'summary',  section: 'basic',      label: 'Write a summary (20+ characters)' },
  { key: 'location', section: 'basic',      label: 'Add your location' },
  { key: 'photo',    section: 'basic',      label: 'Upload a profile photo' },
  { key: 'links',    section: 'basic',      label: 'Add a LinkedIn or GitHub link' },
  { key: 'skills',   section: 'skills',     label: 'Add at least one skill' },
  { key: 'exp',      section: 'experience', label: 'Add a work experience entry' },
  { key: 'edu',      section: 'education',  label: 'Add an education entry' },
  { key: 'proj',     section: 'projects',   label: 'Add a project' },
]);

/**
 * Tier thresholds + matching colors. Exported so the wizard meter can use
 * the same color the editor sidebar uses (no longer two divergent palettes).
 */
export const COMPLETION_TIERS = Object.freeze([
  { min: 80, label: 'Advanced',     color: '#16a34a' },
  { min: 50, label: 'Intermediate', color: '#f59e0b' },
  { min:  0, label: 'Beginner',     color: '#94a3b8' },
]);

const tierForPct = (pct) =>
  COMPLETION_TIERS.find((t) => pct >= t.min) || COMPLETION_TIERS[COMPLETION_TIERS.length - 1];

export const computeProfileCompletion = (profile = {}) => {
  const skillCount = flattenSkills(profile.skills).filter(isReal).length;

  const validExp = (profile.experience || []).filter(
    (e) => hasRealEntry(e, ['company', 'title']) && (isReal(e.startDate) || isReal(e.endDate) || isReal(e.period))
  );
  const validEdu = (profile.education || []).filter(
    (e) => hasRealEntry(e, ['institution']) && isReal(e.degree)
  );
  const validProj = (profile.projects || []).filter(
    (p) => hasRealEntry(p, ['title']) && isReal(p.description)
  );

  // Each item contributes 1 point; total of 9 → ~11% per item.
  // `action` lets the Dashboard checklist deep-link into the right editor section.
  const doneByKey = {
    title:    isReal(profile.title || profile.headline),
    summary:  isReal(profile.summary) && String(profile.summary).trim().length >= 20,
    location: isReal(profile.location),
    photo:    !!profile.profilePicture,
    links:    isReal(profile.linkedinUrl) || isReal(profile.githubUrl),
    skills:   skillCount > 0,
    exp:      validExp.length > 0,
    edu:      validEdu.length > 0,
    proj:     validProj.length > 0,
  };
  const checklist = COMPLETION_RUBRIC.map((r) => ({ ...r, done: !!doneByKey[r.key] }));

  const total = checklist.length;
  const score = checklist.filter((it) => it.done).length;
  const perItem = 100 / total;
  const items = checklist.map((it) => ({ ...it, gainPct: Math.round(perItem) }));
  const missing = items.filter((it) => !it.done);
  const pct = Math.round((score / total) * 100);
  const tier = tierForPct(pct);

  return {
    pct,
    label: tier.label,
    color: tier.color,
    score,
    total,
    items,
    missing,
    done: pct >= 100,
  };
};

const useProfileCompletion = (profile) =>
  useMemo(() => computeProfileCompletion(profile || {}), [profile]);

export default useProfileCompletion;
