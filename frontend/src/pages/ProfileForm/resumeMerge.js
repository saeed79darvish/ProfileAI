// Pure helpers for bringing a parsed resume into a profile the person may
// already have built (by hand, or with the coach). Uploading used to apply the
// parse straight over the form: typed scalars lost to parsed ones, an empty
// skills parse wiped every skill, and experience/education/projects were
// replaced wholesale. These helpers let the editor show what would change and
// merge without destroying anything the person wrote.
//
// Everything here works on the editor's formData shape (skills as a
// categorised object). The caller categorises parsed skills and normalises
// parsed education rows before handing them over, so this module stays free
// of the editor's keyword tables and can run under `node --test`.

export const SKILL_CATEGORIES = Object.freeze(['core', 'technical', 'software', 'industry', 'soft']);

// Scalar fields a resume can supply, with the label used in the review dialog.
export const SCALAR_FIELDS = Object.freeze([
  ['title', 'Title'],
  ['summary', 'Summary'],
  ['location', 'Location'],
  ['phone', 'Phone'],
  ['linkedinUrl', 'LinkedIn'],
  ['githubUrl', 'GitHub'],
  ['portfolioUrl', 'Portfolio'],
]);

// Row sections and how two rows are recognised as the same entry. A key of ''
// means the row has nothing identifying, so it never matches anything and is
// simply added.
export const ROW_SECTIONS = Object.freeze([
  {
    key: 'experience',
    label: 'Experience',
    noun: ['role', 'roles'],
    // Company alone is too loose (people change roles inside one employer)
    // and title alone is too loose (every other row is "Software Engineer").
    rowKey: (r) => {
      const company = normalizeText(r?.company);
      const title = normalizeText(r?.title);
      return company || title ? `${company}|${title}` : '';
    },
  },
  {
    key: 'education',
    label: 'Education',
    noun: ['school', 'schools'],
    rowKey: (r) => normalizeText(r?.institution),
  },
  {
    key: 'projects',
    label: 'Projects',
    noun: ['project', 'projects'],
    rowKey: (r) => normalizeText(r?.title),
  },
]);

/** Lowercase, strip punctuation and collapse whitespace, for matching only. */
export function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whether a field counts as "not filled in". `false` and `0` are real values
 * (an unchecked "current role" box is an answer), so only missing values,
 * blank strings and empty arrays are empty.
 */
export function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Every skill across categories, flattened. Accepts an array too. */
export function flattenSkills(skills) {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills.filter((s) => !isEmptyValue(s));
  return SKILL_CATEGORIES.flatMap((c) => (Array.isArray(skills[c]) ? skills[c] : []))
    .filter((s) => !isEmptyValue(s));
}

/**
 * Whether the form holds anything the person would mind losing. Contact
 * details alone do not count: they are the same on every resume and are
 * never what a merge prompt is protecting.
 */
export function hasMeaningfulContent(form) {
  if (!form) return false;
  return !isEmptyValue(form.title)
    || !isEmptyValue(form.summary)
    || (form.experience || []).length > 0
    || (form.education || []).length > 0
    || (form.projects || []).length > 0
    || flattenSkills(form.skills).length > 0;
}

/** Copy of `existing` with only its empty fields filled from `incoming`. */
export function fillEmptyFields(existing, incoming) {
  const out = { ...existing };
  for (const [k, v] of Object.entries(incoming || {})) {
    if (isEmptyValue(out[k]) && !isEmptyValue(v)) out[k] = v;
  }
  return out;
}

/**
 * Keep every existing row; fill the empty fields of rows the resume also has;
 * append resume rows that match nothing. Duplicates inside the parse itself
 * collapse into the first one so a resume that lists a role twice adds it once.
 */
export function mergeRows(existing = [], incoming = [], rowKey) {
  const rows = existing.map((r) => ({ ...r }));
  const indexByKey = new Map();
  rows.forEach((r, i) => {
    const k = rowKey(r);
    if (k && !indexByKey.has(k)) indexByKey.set(k, i);
  });
  let added = 0;
  let matched = 0;
  for (const row of incoming || []) {
    const k = rowKey(row);
    if (k && indexByKey.has(k)) {
      const i = indexByKey.get(k);
      rows[i] = fillEmptyFields(rows[i], row);
      if (i < existing.length) matched += 1;
      continue;
    }
    rows.push({ ...row });
    if (k) indexByKey.set(k, rows.length - 1);
    added += 1;
  }
  return { rows, added, matched };
}

/**
 * Union of two categorised skill sets. A skill already present anywhere is
 * not added again, case-insensitively, even if the parse filed it under a
 * different category: the person's own filing wins.
 */
export function mergeSkills(existing = {}, incoming = {}) {
  const out = {};
  const seen = new Set();
  for (const c of SKILL_CATEGORIES) {
    out[c] = [];
    for (const s of (existing && existing[c]) || []) {
      out[c].push(s);
      seen.add(normalizeText(s));
    }
  }
  let added = 0;
  for (const c of SKILL_CATEGORIES) {
    for (const s of (incoming && incoming[c]) || []) {
      const k = normalizeText(s);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out[c].push(s);
      added += 1;
    }
  }
  // Keep any non-standard categories the existing form carried.
  for (const [c, v] of Object.entries(existing || {})) {
    if (!(c in out)) out[c] = v;
  }
  return { skills: out, added };
}

/** "Merge (keep mine, add what's new)". */
export function mergeResumeIntoForm(form, parsed) {
  const next = { ...form };
  for (const [field] of SCALAR_FIELDS) {
    if (isEmptyValue(next[field]) && !isEmptyValue(parsed?.[field])) next[field] = parsed[field];
  }
  next.skills = mergeSkills(form.skills, parsed?.skills).skills;
  for (const { key, rowKey } of ROW_SECTIONS) {
    next[key] = mergeRows(form[key] || [], parsed?.[key] || [], rowKey).rows;
  }
  return next;
}

/**
 * "Replace with resume", and the direct path for an empty form. The resume
 * wins wherever it has something, but a section it came back empty for is
 * left alone: a parse that found no skills is not a reason to delete skills.
 */
export function replaceFormWithResume(form, parsed) {
  const next = { ...form };
  for (const [field] of SCALAR_FIELDS) {
    if (!isEmptyValue(parsed?.[field])) next[field] = parsed[field];
  }
  if (flattenSkills(parsed?.skills).length > 0) {
    const skills = {};
    for (const c of SKILL_CATEGORIES) skills[c] = [...((parsed.skills && parsed.skills[c]) || [])];
    next.skills = skills;
  }
  for (const { key } of ROW_SECTIONS) {
    if ((parsed?.[key] || []).length > 0) next[key] = parsed[key].map((r) => ({ ...r }));
  }
  return next;
}

const clip = (value, max = 60) => {
  const s = String(value).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};

const plural = (n, [one, many]) => `${n} ${n === 1 ? one : many}`;

/**
 * Per-section differences between the form and a parse, for the review
 * dialog. Only sections the resume actually has something for are listed,
 * and scalars that already agree are skipped. Each entry carries a ready
 * `text` line plus the numbers behind it.
 */
export function diffResumeAgainstForm(form, parsed) {
  const entries = [];
  for (const [field, label] of SCALAR_FIELDS) {
    const theirs = parsed?.[field];
    if (isEmptyValue(theirs)) continue;
    const yours = form?.[field];
    if (normalizeText(yours) === normalizeText(theirs)) continue;
    entries.push({
      section: field,
      label,
      kind: 'scalar',
      yours: isEmptyValue(yours) ? '' : yours,
      fromResume: theirs,
      text: isEmptyValue(yours)
        ? `${label}: empty now / from resume "${clip(theirs)}"`
        : `${label}: yours "${clip(yours)}" / from resume "${clip(theirs)}"`,
    });
  }

  const parsedSkills = flattenSkills(parsed?.skills);
  if (parsedSkills.length > 0) {
    const yoursCount = flattenSkills(form?.skills).length;
    const { added } = mergeSkills(form?.skills, parsed?.skills);
    entries.push({
      section: 'skills',
      label: 'Skills',
      kind: 'skills',
      fromResume: parsedSkills.length,
      yours: yoursCount,
      newCount: added,
      text: `Skills: ${parsedSkills.length} from resume, ${yoursCount} you have; ${added} new`,
    });
  }

  for (const { key, label, noun, rowKey } of ROW_SECTIONS) {
    const incoming = parsed?.[key] || [];
    if (incoming.length === 0) continue;
    const existing = form?.[key] || [];
    const { added, matched } = mergeRows(existing, incoming, rowKey);
    entries.push({
      section: key,
      label,
      kind: 'rows',
      fromResume: incoming.length,
      yours: existing.length,
      matching: matched,
      newCount: added,
      text: `${label}: ${plural(incoming.length, noun)} from resume, ${existing.length} you have; ${matched} ${matched === 1 ? 'matches' : 'match'}`,
    });
  }
  return entries;
}
