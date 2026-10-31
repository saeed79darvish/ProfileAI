/**
 * Enhance with AI, step three: the rewrite as a list of changes the candidate
 * keeps or skips one at a time.
 *
 * The old preview offered whole sections, so keeping one good bullet meant
 * keeping every bullet in that section. Each change here is the smallest unit
 * a reader would judge on its own: the title, the summary, one bullet, one job
 * title, one education entry. The client applies the kept ones onto the
 * profile it sent, so nothing the candidate skipped can leak into the save.
 */

const { splitBullets } = require('./enhanceAnalysis');
const { textChanged } = require('./enhancementDiff');

const HAS_NUMBER = /\d/;

// Words whose addition or removal alone is not a rewrite worth reviewing.
const FILLER = new Set(['a', 'an', 'the', 'of', 'to', 'and', 'for', 'with', 'in', 'on']);
const contentWords = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9%$+#.]+/g, ' ')
  .split(/\s+/).filter((w) => w && !FILLER.has(w)).map((w) => w.replace(/\.$/, '')).join(' ');
/** "Led migration" and "Led the migration" are the same bullet. */
const sameContent = (a, b) => contentWords(a) === contentWords(b);

const roleTitle = (e) => String((e && (e.title || e.position)) || '').trim();

function educationLine(e = {}) {
  const degree = [e.degree, e.field || e.fieldOfStudy].filter(Boolean).join(', ');
  const school = e.institution || e.school || '';
  const when = e.period || e.year || e.graduationYear || e.endDate || '';
  return [degree, school, when].map((x) => String(x || '').trim()).filter(Boolean).join(' · ');
}

/**
 * @param {Object} original - the profile that was sent for enhancement
 * @param {Object} enhanced - the audited rewrite
 * @param {Object} opts
 * @param {string[]} opts.sections - the sections the candidate chose
 * @param {Object}  [opts.actions] - chosen action ids per section
 * @returns {Array<Object>} changes, in reading order
 */
function buildReviewChanges(original = {}, enhanced = {}, { sections = [], actions = {} } = {}) {
  const chosen = new Set(sections);
  const askForResults = (actions.experience || []).includes('add_results');
  const changes = [];

  if (chosen.has('title') && enhanced.title && textChanged(original.title || original.headline, enhanced.title)) {
    changes.push({ id: 'title', section: 'title', kind: 'title', label: 'Title', before: String(original.title || original.headline || ''), after: String(enhanced.title) });
  }

  if (chosen.has('summary') && enhanced.summary && textChanged(original.summary, enhanced.summary)) {
    changes.push({ id: 'summary', section: 'summary', kind: 'summary', label: 'Summary', before: String(original.summary || ''), after: String(enhanced.summary) });
  }

  if (chosen.has('experience')) {
    const src = Array.isArray(original.experience) ? original.experience : [];
    const out = Array.isArray(enhanced.experience) ? enhanced.experience : [];
    src.forEach((o, i) => {
      const e = out[i];
      if (!o || !e) return;
      const label = `Experience · ${String(o.company || roleTitle(o) || `Role ${i + 1}`).trim()}`;

      const before = roleTitle(o);
      const after = roleTitle(e);
      if (after && before !== after) {
        changes.push({ id: `exp-${i}-title`, section: 'experience', kind: 'role_title', label, index: i, before, after });
      }

      const ob = splitBullets(o.description);
      const eb = splitBullets(e.description);
      if (ob.length === eb.length) {
        ob.forEach((line, j) => {
          // Any real wording change is shown; the candidate decides if it is
          // worth keeping. An added "the" is not one.
          if (sameContent(line, eb[j])) return;
          changes.push({
            id: `exp-${i}-b${j}`,
            section: 'experience',
            kind: 'bullet',
            label,
            index: i,
            bullet: j,
            before: line,
            after: eb[j],
            // A bullet that still has no result after the rewrite: ask the
            // candidate for the figure rather than let the model make one up.
            askResult: askForResults && !HAS_NUMBER.test(eb[j]),
          });
        });
      } else if (String(o.description || '').trim() !== String(e.description || '').trim()) {
        // Bullets were split, merged or trimmed: the role is judged as a whole.
        changes.push({ id: `exp-${i}-desc`, section: 'experience', kind: 'description', label, index: i, before: ob.join('\n'), after: eb.join('\n') });
      }
    });
  }

  if (chosen.has('education')) {
    const src = Array.isArray(original.education) ? original.education : [];
    const out = Array.isArray(enhanced.education) ? enhanced.education : [];
    src.forEach((o, i) => {
      const e = out[i];
      if (!o || !e) return;
      const before = educationLine(o);
      const after = educationLine(e);
      if (after && before !== after) {
        changes.push({
          id: `edu-${i}`,
          section: 'education',
          kind: 'education',
          label: `Education · ${String(o.institution || o.school || o.degree || `Entry ${i + 1}`).trim()}`,
          index: i,
          before,
          after,
          // Only the display fields; the client merges them over the entry.
          value: {
            degree: e.degree,
            field: e.field || e.fieldOfStudy,
            institution: e.institution || e.school,
            period: e.period || e.year,
          },
        });
      }
    });
  }

  return changes;
}

module.exports = { buildReviewChanges, educationLine };
