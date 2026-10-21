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
 * Rubric — up to 9 items, equal weight among the items that APPLY to this
 * profile. Empty input gives 0%. This is the one profile score: the editor,
 * the dashboard and the coach all read this number.
 *
 *   ┌─────────────┬───────────────────────────────────────────────────────┐
 *   │ key         │ done when…                                            │
 *   ├─────────────┼───────────────────────────────────────────────────────┤
 *   │ title       │ profile.title (or .headline) is a real string         │
 *   │ summary     │ profile.summary is real AND ≥ 20 characters           │
 *   │ location    │ profile.location is a real string                     │
 *   │ photo       │ OPTIONAL: never counted, returned in `optional`        │
 *   │ links       │ profile.linkedinUrl OR profile.githubUrl is real      │
 *   │ skills      │ ≥ 1 real skill (across all categories if keyed)       │
 *   │ exp         │ ≥ 1 experience row with company, title, AND a date    │
 *   │ edu         │ ≥ 1 education row with institution AND degree         │
 *   │ proj        │ ≥ 1 project row with title AND description            │
 *   └─────────────┴───────────────────────────────────────────────────────┘
 *
 * Applicability (the coach's rules, now everyone's):
 *   - photo never counts. Onboarding never asks for it, so it never docks
 *     anyone; it is returned in `optional` so UIs can still nudge for it.
 *   - proj does not count when the profile has experience: someone with a
 *     job is never asked for projects.
 *   - exp does not count when there is no experience but there ARE projects:
 *     they were asked for projects instead, so they are not docked twice.
 *   "Has experience / projects" means at least one row with any real content;
 *   an empty row added by a button click does not change what applies.
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
 * Returns: { pct, label, color, score, total, items, missing, done, optional }
 *   - items:    the items that count, { key, section, label, gainPct, done }.
 *               Items that do not apply are omitted, not flagged.
 *   - missing:  subset of items where done === false
 *   - optional: items shown as nice-to-have but never scored (photo), each
 *               { key, section, label, done, optional: true }
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
  { key: 'photo',    section: 'basic',      label: 'Upload a profile photo', optional: true },
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

  // Each counted item contributes 1 point; see "Applicability" above.
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
  const hasAnyExperience = (profile.experience || []).some(
    (e) => !!e && (isReal(e.company) || isReal(e.title))
  );
  const hasAnyProjects = (profile.projects || []).some(
    (p) => !!p && (isReal(p.title) || isReal(p.description))
  );
  const applies = (key) => {
    if (key === 'proj') return !hasAnyExperience;
    if (key === 'exp') return hasAnyExperience || !hasAnyProjects;
    return true;
  };

  const checklist = COMPLETION_RUBRIC.map((r) => ({ ...r, done: !!doneByKey[r.key] }));
  const optional = checklist.filter((it) => it.optional);
  const counted = checklist.filter((it) => !it.optional && applies(it.key));

  const total = counted.length;
  const score = counted.filter((it) => it.done).length;
  const perItem = 100 / total;
  const items = counted.map((it) => ({ ...it, gainPct: Math.round(perItem) }));
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
    optional,
    done: pct >= 100,
  };
};

const useProfileCompletion = (profile) =>
  useMemo(() => computeProfileCompletion(profile || {}), [profile]);

export default useProfileCompletion;
