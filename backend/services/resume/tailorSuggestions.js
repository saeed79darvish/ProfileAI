/**
 * Tailor for a Job, Save step: the three changes worth a candidate's attention.
 *
 * A tailored resume rewrites dozens of lines. Showing all of them asks for a
 * line-by-line review nobody does on a phone; showing none hides that the
 * resume changed at all. Three carry most of what a recruiter reads first:
 * the title, the summary, and one bullet in the most recent role. Each comes
 * with the model's own changelog note for that section as its reason.
 *
 * Skipping one puts the candidate's original text back in the tailored copy;
 * everything else in the copy stays tailored.
 */

const { textChanged } = require('./enhancementDiff');

const BULLET_MARK = /^\s*[•\-*–]\s*/;

function splitBullets(description) {
  return String(description || '')
    .split(/\n/)
    .map((line) => line.replace(BULLET_MARK, '').trim())
    .filter(Boolean);
}

const words = (text) => new Set(String(text || '').toLowerCase().replace(/[^a-z0-9%$+#.]+/g, ' ').split(/\s+/).filter((w) => w.length > 2));

function overlap(a, b) {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  return shared / Math.min(wa.size, wb.size);
}

/** The changelog note for a section, as one plain sentence. */
function reasonFor(changelog, sections) {
  const entry = (Array.isArray(changelog) ? changelog : []).find(
    (c) => c && sections.includes(String(c.section || '').toLowerCase()) && typeof c.detail === 'string' && c.detail.trim()
  );
  if (!entry) return '';
  const detail = entry.detail.trim().replace(/\s+/g, ' ');
  return /[.!?]$/.test(detail) ? detail : `${detail}.`;
}

/**
 * The tailored bullet in the most recent role that moved the most from its
 * original, paired with that original. Bullets are matched by shared words,
 * not position, because tailoring reorders them.
 */
function keyBullet(original, tailored) {
  const o = (original.experience || [])[0];
  const t = (tailored.experience || [])[0];
  if (!o || !t) return null;
  const sources = splitBullets(o.description);
  const outs = splitBullets(t.description);
  let best = null;
  outs.forEach((after, index) => {
    let match = null;
    let score = 0;
    for (const before of sources) {
      const s = overlap(before, after);
      if (s > score) { score = s; match = before; }
    }
    // An added line, or one matched well enough to be "the same bullet".
    const before = score >= 0.35 ? match : '';
    if (before && !textChanged(before, after)) return;
    // Prefer a real rewrite of a bullet the candidate wrote over an addition.
    const rank = before ? 1 + (1 - score) : 0.5;
    if (!best || rank > best.rank) best = { index, before, after, rank };
  });
  return best;
}

/**
 * @param {Object} original - the profile tailoring started from
 * @param {Object} tailored - the tailoring result
 * @returns {Array<Object>} up to three suggestions
 */
function buildTailorSuggestions(original = {}, tailored = {}) {
  const out = [];
  const changelog = tailored.changelog;

  const beforeTitle = String(original.title || original.headline || '').trim();
  if (tailored.title && textChanged(beforeTitle, tailored.title)) {
    out.push({
      id: 'title',
      kind: 'title',
      label: 'Title',
      before: beforeTitle,
      after: String(tailored.title).trim(),
      reason: reasonFor(changelog, ['title', 'headline']),
    });
  }

  if (tailored.summary && textChanged(original.summary, tailored.summary)) {
    out.push({
      id: 'summary',
      kind: 'summary',
      label: 'Summary',
      before: String(original.summary || '').trim(),
      after: String(tailored.summary).trim(),
      reason: reasonFor(changelog, ['summary']),
    });
  }

  const bullet = keyBullet(original, tailored);
  if (bullet) {
    const role = (tailored.experience || [])[0] || {};
    out.push({
      id: 'bullet',
      kind: 'bullet',
      label: `Key bullet · ${String(role.company || role.title || 'Recent role').trim()}`,
      index: 0,
      bullet: bullet.index,
      before: bullet.before,
      after: bullet.after,
      added: !bullet.before,
      reason: reasonFor(changelog, ['experience_1', 'experience']),
    });
  }
  return out;
}

module.exports = { buildTailorSuggestions, keyBullet };
