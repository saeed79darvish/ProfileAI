import { useMemo } from 'react';

/**
 * Shared profile-completion scoring used by both the ProfileForm sidebar and
 * the Dashboard "Complete your profile" checklist, so the two never drift.
 *
 * Accepts a profile-like object. `skills` may be either an object keyed by
 * category (each an array) or a flat array — both shapes are handled.
 *
 * Returns: { pct, label, score, total, items, missing, done }
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
  const checklist = [
    { key: 'title',    section: 'basic',      label: 'Add a professional title',         done: isReal(profile.title || profile.headline) },
    { key: 'summary',  section: 'basic',      label: 'Write a summary (20+ characters)', done: isReal(profile.summary) && String(profile.summary).trim().length >= 20 },
    { key: 'location', section: 'basic',      label: 'Add your location',                done: isReal(profile.location) },
    { key: 'photo',    section: 'basic',      label: 'Upload a profile photo',           done: !!profile.profilePicture },
    { key: 'links',    section: 'basic',      label: 'Add a LinkedIn or GitHub link',    done: isReal(profile.linkedinUrl) || isReal(profile.githubUrl) },
    { key: 'skills',   section: 'skills',     label: 'Add at least one skill',           done: skillCount > 0 },
    { key: 'exp',      section: 'experience', label: 'Add a work experience entry',      done: validExp.length > 0 },
    { key: 'edu',      section: 'education',  label: 'Add an education entry',           done: validEdu.length > 0 },
    { key: 'proj',     section: 'projects',   label: 'Add a project',                    done: validProj.length > 0 },
  ];

  const total = checklist.length;
  const score = checklist.filter((it) => it.done).length;
  const perItem = 100 / total;
  const items = checklist.map((it) => ({ ...it, gainPct: Math.round(perItem) }));
  const missing = items.filter((it) => !it.done);
  const pct = Math.round((score / total) * 100);
  const label = pct >= 80 ? 'Advanced' : pct >= 50 ? 'Intermediate' : 'Beginner';

  return { pct, label, score, total, items, missing, done: pct >= 100 };
};

const useProfileCompletion = (profile) =>
  useMemo(() => computeProfileCompletion(profile || {}), [profile]);

export default useProfileCompletion;
