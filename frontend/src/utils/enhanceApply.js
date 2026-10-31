// Enhance with AI, Review step: put the changes the candidate kept onto their
// own profile record. The record is patched field by field rather than
// replaced with the AI's copy, so dates, locations and everything else the
// rewrite never saw stay exactly as they were.
//
// Bullet indexes count non-empty lines with their bullet mark stripped, the
// same way the server's splitBullets does (backend/services/resume/enhanceAnalysis.js).

const BULLET_MARK = /^\s*[•\-*–]\s*/;

export function replaceBullet(description, index, text) {
  const lines = String(description || '').split('\n');
  let seen = -1;
  for (let i = 0; i < lines.length; i++) {
    const body = lines[i].replace(BULLET_MARK, '').trim();
    if (!body) continue;
    seen += 1;
    if (seen === index) {
      const mark = (lines[i].match(BULLET_MARK) || [''])[0];
      lines[i] = `${mark}${text}`;
      return lines.join('\n');
    }
  }
  return description;
}

/** Drop the index-th bullet (same counting as replaceBullet). */
export function removeBullet(description, index) {
  const lines = String(description || '').split('\n');
  let seen = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].replace(BULLET_MARK, '').trim()) continue;
    seen += 1;
    if (seen === index) {
      lines.splice(i, 1);
      return lines.join('\n');
    }
  }
  return description;
}

const pickKey = (entry, preferred, alternate) =>
  (alternate in entry && !(preferred in entry) ? alternate : preferred);

/**
 * @param {Object} profile - the record the changes were computed against
 * @param {Array<Object>} changes - kept changes from the enhance response
 * @returns {Object} a new profile; the input is not mutated
 */
export function applyEnhanceChanges(profile, changes = []) {
  const next = {
    ...profile,
    experience: Array.isArray(profile?.experience) ? profile.experience.map((e) => ({ ...e })) : profile?.experience,
    education: Array.isArray(profile?.education) ? profile.education.map((e) => ({ ...e })) : profile?.education,
  };
  for (const c of changes) {
    const text = typeof c.after === 'string' ? c.after.trim() : '';
    if (c.kind === 'title' && text) next.title = text;
    else if (c.kind === 'summary' && text) next.summary = text;
    else if (['role_title', 'bullet', 'description'].includes(c.kind)) {
      const entry = next.experience?.[c.index];
      if (!entry || !text) continue;
      if (c.kind === 'role_title') entry[pickKey(entry, 'title', 'position')] = text;
      else if (c.kind === 'bullet') entry.description = replaceBullet(entry.description, c.bullet, text);
      else entry.description = text;
    } else if (c.kind === 'education') {
      const entry = next.education?.[c.index];
      const v = c.value || {};
      if (!entry) continue;
      if (v.degree) entry.degree = v.degree;
      if (v.field) entry[pickKey(entry, 'field', 'fieldOfStudy')] = v.field;
      if (v.institution) entry[pickKey(entry, 'institution', 'school')] = v.institution;
      // Dates are only rewritten where the entry keeps them as one text
      // field; structured start/end dates are left alone.
      if (v.period && ('period' in entry || 'year' in entry)) entry['period' in entry ? 'period' : 'year'] = v.period;
    }
  }
  return next;
}
