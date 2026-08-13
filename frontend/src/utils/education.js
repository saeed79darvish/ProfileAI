import { isPresentValue } from './dateRange';

/**
 * Canonicalise education rows onto the keys the profile editor reads and writes.
 *
 * Every producer spells the same fields differently: the resume parser and the
 * AI prompt emit `field` + `current: true`, the LinkedIn importer emits
 * `school`, older saved rows carry `university`/`major`, and the editor itself
 * writes `institution` + `fieldOfStudy` + endDate: 'Present'.
 *
 * The Institution and Degree inputs read one spelling only, so a row that
 * arrived under an alias rendered with a blank institution — and the save path
 * drops any row with no institution *and* no degree as an empty entry. That is
 * how a freshly parsed Education section could look populated on screen and
 * come back empty after saving. Normalising at every point data enters the form
 * keeps what the user sees and what the save filter tests in sync.
 *
 * `field` stays mirrored alongside `fieldOfStudy` because the resume generator
 * and PDF renderer read `field`.
 */
export const normalizeEducationRows = (rows) =>
  (rows || []).map((row) => {
    if (!row || typeof row !== 'object') return row;
    const next = { ...row };

    next.institution = next.institution || next.school || next.university || '';
    delete next.school;
    delete next.university;

    const fieldOfStudy = next.fieldOfStudy || next.field || next.major || '';
    next.fieldOfStudy = fieldOfStudy;
    next.field = fieldOfStudy;
    delete next.major;

    // The parser encodes in-progress study as `current: true` + endDate null;
    // the editor encodes it as endDate: 'Present'. Keep only the latter, or the
    // "Currently enrolled" checkbox renders unchecked on a parsed row.
    if (next.current === true && !isPresentValue(next.endDate)) next.endDate = 'Present';
    delete next.current;

    return next;
  });

export default normalizeEducationRows;
