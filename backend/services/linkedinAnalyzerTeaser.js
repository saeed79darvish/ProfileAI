/**
 * LinkedIn Profile Analyzer — teaser payload builder.
 *
 * The guest endpoint MUST NOT ship the locked content in the API response
 * (the plan explicitly ruled out client-side CSS gating). This module takes
 * the full Claude output and returns the exact teaser shape the extension
 * modal renders in guest mode:
 *
 *   - all three scores + grade bands (rendered by the extension)
 *   - verdict + summary (summary already ends with the bridge line thanks
 *     to the guest prompt variant)
 *   - quickWinsLocked: item 01 with full body, items 02-05 title-only
 *
 * `sections`, `recruiterSearch`, and the full `priorityFixes` array are
 * intentionally omitted. The full JSON stays in the cache row and is only
 * released when the user submits their email (report) or signs in
 * (full modal).
 */

const clampStr = (s, n) => {
  if (s == null) return '';
  const str = typeof s === 'string' ? s : String(s);
  return str.length > n ? str.slice(0, n) : str;
};

/**
 * Given a full LinkedInProfileAnalysis JSON (as produced by
 * aiService.analyzeLinkedInProfile), build the teaser response.
 * @param {object} full  The full analysis JSON.
 * @param {object} meta  { analysisId, expiresAt } to include at the top.
 */
const buildTeaser = (full, meta = {}) => {
  const analysis = full || {};
  const priorityFixes = Array.isArray(analysis.priorityFixes) ? analysis.priorityFixes : [];

  // Extract a short "title" for each priority fix. The full text is usually
  // one sentence — everything up to the first period, colon, or dash makes
  // a decent locked-row title.
  const toTitle = (raw) => {
    if (!raw) return '';
    const str = String(raw).trim();
    // Prefer the first clause before a period / colon / em dash.
    const m = str.match(/^[^.:—–\-]+/);
    let title = (m ? m[0] : str).trim();
    // Strip trailing filler like " -", " (…", stray quotes.
    title = title.replace(/[\s\-–—]+$/g, '').trim();
    return clampStr(title, 90);
  };

  // We want exactly 5 rows for the "Your top 5 fixes" grid — pad or trim.
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const raw = priorityFixes[i];
    if (i === 0) {
      // Item 01: fully unlocked (title + body).
      rows.push({
        index: i,
        title: toTitle(raw) || 'Your first fix',
        body: raw ? clampStr(String(raw).trim(), 800) : '',
        locked: false,
      });
    } else {
      // Items 02-05: title only. If we have fewer than 5 real items, the
      // remaining rows fall back to generic locked placeholders so the
      // teaser grid always has 5 rows and never leaks a placeholder body.
      rows.push({
        index: i,
        title: toTitle(raw) || `Fix ${String(i + 1).padStart(2, '0')}: unlock to view`,
        locked: true,
      });
    }
  }

  return {
    analysisId: meta.analysisId || null,
    expiresAt: meta.expiresAt || null,
    teaser: {
      mode: 'guest',
      overallScore: Number(analysis.overallScore) || 0,
      recruiterFitScore: Number(analysis.recruiterFitScore) || 0,
      searchVisibilityScore: Number(analysis.searchVisibilityScore) || 0,
      verdict: analysis.verdict || 'maybe',
      summary: clampStr(analysis.summary || '', 700),
      quickWinsLocked: rows,
    },
  };
};

module.exports = { buildTeaser };
