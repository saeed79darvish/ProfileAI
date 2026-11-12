/**
 * Reads the model's job-match answer.
 *
 * The answer is one JSON object: every requirement with its evidence, then the three
 * fit numbers and the verdict LAST. A long posting can run past the token limit, which
 * cuts the object off. A bare JSON.parse then fails and the candidate is told the
 * posting could not be read (a 24-bullet posting did exactly that).
 *
 * A cut-off answer is repaired when it still carries the fit numbers, because
 * the score multiplies by roleFit: an answer that lost them would score 0%, and
 * a 0% that is only an artefact of truncation is worse than no score. Such an
 * answer is rejected like any unreadable one.
 */
const { repairTruncatedJSON } = require('../resumeParserService');

function parseJobMatchRead(raw) {
  const text = String(raw || '');
  const start = text.indexOf('{');
  if (start === -1) return { read: null, repaired: false };
  const body = text.slice(start);

  let read = null;
  let repaired = false;
  try {
    const m = text.match(/\{[\s\S]*\}/);
    read = m ? JSON.parse(m[0]) : null;
  } catch (_) {
    read = null;
  }
  if (!read) {
    // repairTruncatedJSON hands back the parsed object (or null), not text.
    read = repairTruncatedJSON(body) || null;
    repaired = !!read;
  }

  const ok = read
    && Array.isArray(read.requirements) && read.requirements.length > 0
    && Number.isFinite(Number(read.roleFit));
  return { read: ok ? read : null, repaired: ok && repaired };
}

module.exports = { parseJobMatchRead };
