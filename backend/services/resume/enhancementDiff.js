/**
 * Did an enhancement actually change anything?
 *
 * A candidate ran "Enhance" and the preview offered six "enhanced" sections:
 * the title identical to the original, the skills the same 37 entries in a
 * different order, the summary lightly re-worded. They were charged a credit
 * for it, and the preview presented every section as an improvement whether or
 * not it had moved.
 *
 * This module decides, section by section, whether the output differs from the
 * input in a way a reader would notice, and restores any section the candidate
 * did not ask to have rewritten. The route uses the result to show only real
 * changes and to skip the credit entirely when there are none.
 */

/** Lowercase, strip punctuation and collapse whitespace into a word list. */
function words(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Share of the longer text's words that changed, by multiset difference.
 * Order-insensitive on purpose: moving a sentence is not a rewrite, and the
 * preview should not present a shuffle as an improvement.
 */
function wordChangeRatio(a, b) {
  const wa = words(a);
  const wb = words(b);
  if (!wa.length && !wb.length) return 0;
  const count = (list) => list.reduce((m, w) => m.set(w, (m.get(w) || 0) + 1), new Map());
  const ca = count(wa);
  const cb = count(wb);
  let diff = 0;
  for (const [w, n] of ca) diff += Math.max(0, n - (cb.get(w) || 0));
  for (const [w, n] of cb) diff += Math.max(0, n - (ca.get(w) || 0));
  return diff / (2 * Math.max(wa.length, wb.length));
}

/** Below this share of words changed, prose counts as untouched. */
const PROSE_THRESHOLD = 0.08;

const textChanged = (a, b) => {
  const short = words(a).length <= 12 && words(b).length <= 12;
  // A title or a short label: any real word difference is a change.
  if (short) return words(a).join(' ') !== words(b).join(' ');
  return wordChangeRatio(a, b) >= PROSE_THRESHOLD;
};

function flattenSkills(skills) {
  if (Array.isArray(skills)) return skills;
  if (skills && typeof skills === 'object') return Object.values(skills).flat();
  return [];
}

/** Skills compare as a SET: re-ordering the same entries is not a change. */
function skillsChanged(a, b) {
  const norm = (list) => new Set(flattenSkills(list).map((s) => String(s).toLowerCase().trim()).filter(Boolean));
  const sa = norm(a);
  const sb = norm(b);
  if (sa.size !== sb.size) return true;
  for (const s of sa) if (!sb.has(s)) return true;
  return false;
}

const describe = (entry) => (entry && typeof entry === 'object' ? entry.description || '' : '');

function listChanged(a, b) {
  const la = Array.isArray(a) ? a : [];
  const lb = Array.isArray(b) ? b : [];
  if (la.length !== lb.length) return true;
  return la.some((entry, i) => textChanged(describe(entry), describe(lb[i])));
}

const SECTIONS = {
  title: (o, e) => textChanged(o.title, e.title),
  summary: (o, e) => textChanged(o.summary, e.summary),
  skills: (o, e) => skillsChanged(o.skills, e.skills),
  experience: (o, e) => listChanged(o.experience, e.experience),
  projects: (o, e) => listChanged(o.projects, e.projects),
};

/**
 * @param {Object} original - the profile that went in
 * @param {Object} enhanced - what came back (after restoration)
 * @returns {{ changed: string[], unchanged: string[] }}
 */
function diffSections(original = {}, enhanced = {}) {
  const changed = [];
  const unchanged = [];
  for (const [key, isChanged] of Object.entries(SECTIONS)) {
    // A section the model did not return at all is not a change.
    if (enhanced[key] === undefined) continue;
    (isChanged(original, enhanced) ? changed : unchanged).push(key);
  }
  return { changed, unchanged };
}

/**
 * Put back every section the candidate did not select.
 *
 * The prompt asks the model to leave them alone, but asking is the thing that
 * has repeatedly not worked; restoring them in code makes "only these sections"
 * true rather than likely.
 *
 * @param {Object} enhanced - mutated in place
 * @param {Object} original
 * @param {string[]|null} sections - the candidate's selection; null means all
 */
function restoreUnselected(enhanced, original, sections) {
  if (!Array.isArray(sections) || sections.length === 0) return [];
  const selected = new Set(sections);
  const restored = [];
  for (const key of Object.keys(SECTIONS)) {
    if (!selected.has(key) && original[key] !== undefined && enhanced[key] !== undefined) {
      enhanced[key] = original[key];
      restored.push(key);
    }
  }
  return restored;
}

module.exports = { diffSections, restoreUnselected, wordChangeRatio, PROSE_THRESHOLD };
