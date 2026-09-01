/**
 * coachInspect — countable facts about a profile, for the career coach.
 *
 * The coach's review has to be specific ("two of your three roles have no
 * bullets") rather than generic ("consider adding more detail"). Generic
 * feedback is what people already ignore from every other resume tool, and a
 * model asked to critique freehand produces exactly that, plus the occasional
 * confident claim about something that isn't there.
 *
 * So the counting happens here, deterministically, and the model is handed the
 * findings to explain rather than asked to find them. Same division of labour
 * as draftAudit.js uses for the writing passes: count first, judge second.
 *
 * This is NOT profileAudit.js. That one diffs an ENHANCED profile against the
 * candidate's original to catch fabrication introduced by our own AI, and it
 * refuses to run without that source text. Here there is no enhanced version
 * and nothing to diff — the candidate's profile is the subject, not the
 * suspect.
 */

const { findBannedLanguage } = require('./writingRules');

// A bullet shorter than this is a fragment — but only when it also carries no
// number. "Cut routing errors by 30%" is 25 characters and is a better bullet
// than most long ones; length alone is not the defect.
const THIN_BULLET_CHARS = 40;
// Below this many skills a profile is invisible to most recruiter filters.
const THIN_SKILLS = 5;
const STRONG_SKILLS = 10;
// A summary needs to actually say something. Matches the 20-char floor the
// completion rubric uses (frontend/src/hooks/useProfileCompletion.js).
const MIN_SUMMARY_CHARS = 20;

const text = (v) => String(v == null ? '' : v).trim();
const rows = (v) => (Array.isArray(v) ? v : []);

/**
 * Split a description into bullet lines. Handles the three shapes we store:
 * a "• "-prefixed block (what the coach writes), newline-separated lines, and
 * a single paragraph.
 */
function bulletsOf(entry) {
  const description = text(entry && entry.description);
  if (!description) return [];
  return description
    .split('\n')
    .map((line) => line.replace(/^[•\-*•]\s*/, '').trim())
    .filter(Boolean);
}

/** Does this line carry a real, checkable number? */
function hasMetric(line) {
  // A bare year ("2021") is a date, not an outcome — don't credit it.
  const withoutYears = String(line).replace(/\b(19|20)\d{2}\b/g, '');
  return /\d/.test(withoutYears);
}

/**
 * inspectProfile — everything countable about a profile, as data.
 *
 * Returns findings as structured objects rather than sentences: the coach
 * prompt turns them into human language, and the client uses the same objects
 * to decide what to ask about next. One source, two consumers.
 *
 * @param {object} profile  draft or profile-shaped object
 * @returns {{
 *   counts: object,
 *   findings: Array<{code: string, severity: 'blocker'|'weak'|'polish', what: string, where?: string}>,
 *   strengths: string[]
 * }}
 */
function inspectProfile(profile = {}) {
  const experience = rows(profile.experience);
  const education = rows(profile.education);
  const projects = rows(profile.projects);
  const skills = Array.isArray(profile.skills)
    ? profile.skills
    : Object.values(profile.skills || {}).flat();

  const findings = [];
  const strengths = [];

  /* ── Headline and summary ── */
  if (!text(profile.title)) {
    findings.push({ code: 'no_title', severity: 'blocker', what: 'There is no job title on the profile.' });
  }
  const summary = text(profile.summary);
  if (!summary) {
    findings.push({ code: 'no_summary', severity: 'weak', what: 'There is no summary.' });
  } else if (summary.length < MIN_SUMMARY_CHARS) {
    findings.push({ code: 'thin_summary', severity: 'weak', what: `The summary is only ${summary.length} characters.` });
  }

  /* ── Experience ── */
  let totalBullets = 0;
  let bulletsWithMetric = 0;
  const rolesWithoutBullets = [];
  const rolesWithoutDates = [];
  const thinBullets = [];

  experience.forEach((role) => {
    const where = [text(role.title), text(role.company)].filter(Boolean).join(' at ') || 'a role';
    const lines = bulletsOf(role);
    totalBullets += lines.length;
    lines.forEach((line) => {
      if (hasMetric(line)) bulletsWithMetric += 1;
      if (line.length < THIN_BULLET_CHARS && !hasMetric(line)) thinBullets.push({ where, line });
    });
    if (!lines.length) rolesWithoutBullets.push(where);
    if (!text(role.startDate) && !text(role.endDate) && !text(role.period)) rolesWithoutDates.push(where);
  });

  if (!experience.length) {
    findings.push({
      code: 'no_experience',
      severity: 'blocker',
      what: 'There is no work experience listed.',
    });
  }
  rolesWithoutBullets.forEach((where) => {
    findings.push({ code: 'role_no_bullets', severity: 'blocker', what: 'This role has no description at all.', where });
  });
  rolesWithoutDates.forEach((where) => {
    findings.push({ code: 'role_no_dates', severity: 'weak', what: 'This role has no dates, which reads as a gap to a recruiter.', where });
  });
  if (totalBullets > 0 && bulletsWithMetric === 0) {
    findings.push({
      code: 'no_metrics',
      severity: 'weak',
      what: `None of the ${totalBullets} bullet points contain a number.`,
    });
  }
  if (thinBullets.length >= 2) {
    findings.push({
      code: 'thin_bullets',
      severity: 'polish',
      what: `${thinBullets.length} bullet points are one short fragment rather than an accomplishment.`,
      where: thinBullets[0].where,
    });
  }

  /* ── Skills ── */
  if (skills.length === 0) {
    findings.push({ code: 'no_skills', severity: 'blocker', what: 'No skills are listed, so recruiter filters cannot find this profile.' });
  } else if (skills.length < THIN_SKILLS) {
    findings.push({ code: 'thin_skills', severity: 'weak', what: `Only ${skills.length} skills are listed.` });
  }

  /* ── Education and projects ── */
  const realEducation = education.filter((e) => text(e.institution || e.school) && text(e.degree));
  if (!realEducation.length && education.length) {
    findings.push({ code: 'partial_education', severity: 'polish', what: 'An education entry is missing either the school or the qualification.' });
  }
  // Only worth raising when there is also no work history — that is the case
  // where projects are the evidence, not a nice-to-have.
  if (!experience.length && !projects.length) {
    findings.push({
      code: 'no_evidence',
      severity: 'blocker',
      what: 'There is neither work experience nor any project, so nothing evidences the skills claimed.',
    });
  }

  /* ── Language ── */
  const haystack = [
    summary,
    ...experience.flatMap((role) => bulletsOf(role)),
    ...projects.map((p) => text(p.description)),
  ].filter(Boolean).join('\n');
  let banned = [];
  try {
    banned = findBannedLanguage(haystack) || [];
  } catch {
    // The shared checker is used by the writing passes on their own shapes;
    // never let a surprise there take down the coach's review.
    banned = [];
  }
  if (banned.length) {
    findings.push({
      code: 'banned_language',
      severity: 'polish',
      what: `Resume cliches a recruiter skims past: ${banned.slice(0, 4).join(', ')}.`,
    });
  }

  /* ── What is genuinely good (so the coach can lead with it honestly) ── */
  if (bulletsWithMetric >= 2) strengths.push(`${bulletsWithMetric} bullet points carry a real number`);
  if (skills.length >= STRONG_SKILLS) strengths.push(`${skills.length} skills listed`);
  if (experience.length >= 2) strengths.push(`${experience.length} roles of history`);
  if (realEducation.length) strengths.push('education is complete');
  if (projects.length) strengths.push(`${projects.length} project${projects.length > 1 ? 's' : ''} listed`);

  return {
    counts: {
      roles: experience.length,
      bullets: totalBullets,
      bulletsWithMetric,
      metricCoverage: totalBullets ? Math.round((bulletsWithMetric / totalBullets) * 100) : 0,
      skills: skills.length,
      education: realEducation.length,
      projects: projects.length,
      hasSummary: !!summary,
    },
    findings,
    strengths,
  };
}

module.exports = {
  inspectProfile,
  bulletsOf,
  hasMetric,
  THIN_BULLET_CHARS,
  THIN_SKILLS,
  MIN_SUMMARY_CHARS,
};
