/**
 * "Did you apply?" is asked later, not at download time.
 *
 * Downloading a resume or opening the company's page only starts an application
 * (status 'clicked' or 'in_progress'). We ask about it once the person is back:
 * at least QUIET_MINUTES after the last activity, never for one they dismissed,
 * and not again until a snooze has passed.
 */

const { Op } = require('sequelize');

const QUIET_MINUTES = 20;      // long enough to actually fill and submit a form
const MAX_AGE_DAYS = 5;        // an older start is stale: asking about it now would be noise
const SNOOZE_DAYS = 2;         // "Not yet" asks again after this
const MAX_PENDING = 3;

const ANSWERS = ['applied', 'not_yet', 'not_applying'];

/** Sequelize where-clause for applications that are worth asking about now. */
function pendingWhere(userId, now = new Date()) {
  const quietBefore = new Date(now.getTime() - QUIET_MINUTES * 60 * 1000);
  const newerThan = new Date(now.getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  return {
    userId,
    status: { [Op.in]: ['clicked', 'in_progress'] },
    dismissedAt: null,
    updatedAt: { [Op.lt]: quietBefore, [Op.gt]: newerThan },
    [Op.or]: [{ snoozedUntil: null }, { snoozedUntil: { [Op.lt]: now } }],
  };
}

/**
 * The column changes for an answer, or null when the answer is not valid or does
 * not apply to this row. Pure, so it can be tested without a database.
 */
function changesForAnswer(application, answer, now = new Date()) {
  if (!ANSWERS.includes(answer)) return null;
  if (!['clicked', 'in_progress'].includes(application.status)) return null;
  if (answer === 'applied') {
    return { status: 'applied', confirmedBy: 'user', confirmedAt: now, appliedAt: now, askedAt: now, snoozedUntil: null };
  }
  if (answer === 'not_yet') {
    return { askedAt: now, snoozedUntil: new Date(now.getTime() + SNOOZE_DAYS * 24 * 60 * 60 * 1000) };
  }
  return { askedAt: now, dismissedAt: now };
}

const toPending = (a) => ({
  id: a.id,
  jobTitle: a.jobTitle,
  company: a.company,
  jobUrl: a.jobUrl,
  externalJobId: a.externalJobId || null,
  status: a.status,
  startedAt: a.createdAt,
  lastActivityAt: a.updatedAt,
});

module.exports = { pendingWhere, changesForAnswer, toPending, ANSWERS, QUIET_MINUTES, MAX_AGE_DAYS, SNOOZE_DAYS, MAX_PENDING };
