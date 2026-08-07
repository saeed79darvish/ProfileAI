/**
 * Application Tracking Service
 *
 * One place that decides what "the user applied" means, so every signal —
 * in-app Apply click, extension autofill, extension submit detection,
 * ApplyPilot submission, tailored resume, manual confirmation — lands in the
 * same row and can only ever move the row FORWARD.
 *
 * THE LADDER
 * ----------
 *   clicked      the user opened the ATS page. Intent only; we cannot see what
 *                happened next, so this must never be counted as an application.
 *   in_progress  evidence they are actually working on it: the extension
 *                autofilled the form, or they generated a tailored resume for
 *                this posting.
 *   applied      confirmed: the extension saw the form submit / a confirmation
 *                page, ApplyPilot reached the ATS, or the user said so.
 *   screening … no_response   the existing post-application pipeline, untouched.
 *
 * WHY MONOTONIC
 * -------------
 * Signals arrive out of order and repeatedly. A user who applies (via the
 * extension) and later re-opens the posting from our jobs page would otherwise
 * have a confirmed application knocked back down to "clicked" by that second
 * visit — silently losing real data. So promotion is allowed and demotion is
 * not, with one deliberate exception: an explicit user-driven status change
 * (withdrawing, marking rejected) goes through the normal update route, not
 * this service.
 *
 * WHY IT OWNS ROW IDENTITY TOO
 * ----------------------------
 * The same posting can arrive keyed by externalJobId (in-app) or only by URL
 * (extension), with tracking params differing between the two. Resolving both
 * to one row is what stops a single application from occupying two rows and
 * double-counting.
 */

const { Op } = require('sequelize');
const { ExternalApplication } = require('../models');
const { normalizeJobUrl } = require('../utils/jobUrl');

// Ordered ladder. Index = rank; higher wins.
const STAGE_ORDER = [
  'clicked',
  'in_progress',
  'applied',
  'screening',
  'interviewing',
  'offer',
];
// Terminal/side states that sit outside the progression ladder. A row in one of
// these is never auto-promoted by an incoming signal — if a user withdrew an
// application, a stray click must not silently reopen it.
const TERMINAL_STAGES = new Set(['rejected', 'withdrawn', 'no_response']);

/** The first stage that counts as a real application for badges and counts. */
const APPLIED_RANK = STAGE_ORDER.indexOf('applied');

function stageRank(status) {
  const i = STAGE_ORDER.indexOf(status);
  return i === -1 ? -1 : i;
}

/** True when a status means "the user actually applied" (or moved past it). */
function isConfirmedApplication(status) {
  // Post-application pipeline states imply an application happened, so they
  // count. Terminal states are handled explicitly: 'rejected' implies they DID
  // apply, 'withdrawn' means they took it back, 'no_response' implies they did.
  if (status === 'rejected' || status === 'no_response') return true;
  if (status === 'withdrawn') return false;
  return stageRank(status) >= APPLIED_RANK;
}

/**
 * Record a signal about a (user, job) pair.
 *
 * @param {Object}  input
 * @param {string}  input.userId
 * @param {string}  [input.externalJobId]  strongest identity key when known
 * @param {string}  [input.jobUrl]         raw URL; normalized for matching
 * @param {string}  input.stage            one of STAGE_ORDER
 * @param {string}  input.confirmedBy      provenance: click | extension_autofill
 *                                         | extension_submit | applypilot |
 *                                         tailored_resume | user | import
 * @param {Object}  [input.fields]         denormalized job fields used only when
 *                                         CREATING the row (title, company, …)
 * @returns {Promise<{application, created: boolean, promoted: boolean}>}
 */
async function recordApplicationSignal({
  userId,
  externalJobId = null,
  jobUrl = null,
  stage,
  confirmedBy,
  fields = {},
}) {
  if (!userId) throw new Error('recordApplicationSignal: userId is required');
  if (stageRank(stage) === -1) {
    throw new Error(`recordApplicationSignal: unknown stage "${stage}"`);
  }

  const normalizedUrl = normalizeJobUrl(jobUrl) || jobUrl || null;

  // Identity resolution, strongest key first. externalJobId is exact; the
  // normalized URL is the only handle we have on extension-sourced rows.
  const orClauses = [];
  if (externalJobId) orClauses.push({ externalJobId });
  if (normalizedUrl) orClauses.push({ normalizedJobUrl: normalizedUrl });
  // Rows written before normalizedJobUrl existed, or by a client that sent a
  // URL we could not parse, are still reachable on the raw column.
  if (jobUrl) orClauses.push({ jobUrl });

  const existing = orClauses.length
    ? await ExternalApplication.findOne({
        where: { userId, [Op.or]: orClauses },
        // Prefer the most advanced row if this user somehow has more than one
        // for the same posting (pre-existing duplicates from the raw-URL era).
        order: [['createdAt', 'ASC']],
      })
    : null;

  if (!existing) {
    const application = await ExternalApplication.create({
      userId,
      externalJobId,
      jobUrl,
      normalizedJobUrl: normalizedUrl,
      status: stage,
      confirmedBy,
      confirmedAt: new Date(),
      // appliedAt has always meant "when this entered the pipeline" and the UI
      // sorts and labels by it. Only stamp it once the row is genuinely an
      // application, so a click doesn't produce an "Applied 3 days ago" date.
      appliedAt: isConfirmedApplication(stage) ? new Date() : null,
      jobTitle: fields.jobTitle || 'Unknown role',
      company: fields.company || 'Unknown company',
      location: fields.location ?? null,
      locationType: fields.locationType ?? null,
      jobType: fields.jobType ?? null,
      platform: fields.platform ?? null,
      salary: fields.salary ?? null,
      matchScore: fields.matchScore ?? null,
      tailoredProfileId: fields.tailoredProfileId ?? null,
      resumeUsed: fields.resumeUsed ?? null,
      coverLetterUsed: fields.coverLetterUsed ?? false,
      notes: fields.notes ?? null,
    });
    return { application, created: true, promoted: true };
  }

  // Backfill identity/provenance we learned from this signal even when the
  // stage itself doesn't advance — e.g. an extension row that we can now link
  // to a real ExternalJob, or a tailored resume attached to an existing row.
  const patch = {};
  if (externalJobId && !existing.externalJobId) patch.externalJobId = externalJobId;
  if (normalizedUrl && !existing.normalizedJobUrl) patch.normalizedJobUrl = normalizedUrl;
  if (jobUrl && !existing.jobUrl) patch.jobUrl = jobUrl;
  if (fields.tailoredProfileId && !existing.tailoredProfileId) {
    patch.tailoredProfileId = fields.tailoredProfileId;
  }
  if (fields.matchScore != null && existing.matchScore == null) {
    patch.matchScore = fields.matchScore;
  }

  const currentIsTerminal = TERMINAL_STAGES.has(existing.status);
  const shouldPromote =
    !currentIsTerminal && stageRank(stage) > stageRank(existing.status);

  if (shouldPromote) {
    patch.status = stage;
    patch.confirmedBy = confirmedBy;
    patch.confirmedAt = new Date();
    // First time this row becomes a real application, stamp when.
    if (isConfirmedApplication(stage) && !existing.appliedAt) {
      patch.appliedAt = new Date();
    }
  }

  if (Object.keys(patch).length > 0) {
    await existing.update(patch);
  }

  return { application: existing, created: false, promoted: shouldPromote };
}

/**
 * Split a set of external job ids into the ones the user has genuinely applied
 * to versus merely started. Powers the jobs-list badges: only `applied` should
 * render as "Applied"; `started` drives the softer "you began this" affordance
 * and the follow-up nudge.
 */
async function classifyJobIdsForUser(userId, externalJobIds) {
  const out = { applied: [], started: [] };
  if (!userId || !Array.isArray(externalJobIds) || externalJobIds.length === 0) return out;

  const rows = await ExternalApplication.findAll({
    where: { userId, externalJobId: { [Op.in]: externalJobIds } },
    attributes: ['externalJobId', 'status'],
  });
  for (const r of rows) {
    if (isConfirmedApplication(r.status)) out.applied.push(r.externalJobId);
    else if (r.status !== 'withdrawn') out.started.push(r.externalJobId);
  }
  return out;
}

module.exports = {
  recordApplicationSignal,
  classifyJobIdsForUser,
  isConfirmedApplication,
  stageRank,
  STAGE_ORDER,
  TERMINAL_STAGES,
};
