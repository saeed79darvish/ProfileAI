const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/database');

/**
 * ApplyPilotApplication — one row per job the agent prepared (or is
 * preparing) for a candidate. This is what the Dashboard queue and
 * Review screen render.
 */
const ApplyPilotApplication = sequelize.define('ApplyPilotApplication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE',
  },

  // Either one of these is set. externalJobId wins for harvested jobs.
  jobId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Jobs', key: 'id' },
    onDelete: 'SET NULL',
  },
  externalJobId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'ExternalJobs', key: 'id' },
    onDelete: 'SET NULL',
  },

  // Canonical URLs for the posting and the actual apply flow.
  //   jobUrl         → the *job posting* page (description, surfaced as
  //                    "View job posting" in the UI).
  //   applicationUrl → the page where submission actually happens. Often
  //                    the same as jobUrl, but Greenhouse/Lever sometimes
  //                    split them. The submit worker / ATS adapters
  //                    always submit against this one.
  // Both are written together at create time; the resolver helper
  // (services/applyPilotUrlResolver.js) backfills either from the
  // underlying ExternalJob/Job for older rows.
  jobUrl: { type: DataTypes.TEXT, allowNull: true },
  applicationUrl: { type: DataTypes.TEXT, allowNull: true },

  // Denormalized for fast list rendering. Source of truth is the job row.
  company: { type: DataTypes.STRING },
  role: { type: DataTypes.STRING },
  location: { type: DataTypes.STRING },
  salaryText: { type: DataTypes.STRING },
  logoText: { type: DataTypes.STRING(2) },
  companyKey: { type: DataTypes.STRING }, // for the colored logo tile

  // Claude's fit score 0–100, with structured breakdown.
  //   { haveSkills: [...], missingSkills: [...], rationale: string }
  match: { type: DataTypes.INTEGER, defaultValue: 0 },
  matchBreakdown: { type: DataTypes.JSONB, defaultValue: {} },

  // Prep pipeline status. 'pending' → prep worker picks up → 'preparing'
  // → 'prepared' → human approves → 'approved' (enqueued) → 'submitting'
  // (worker running) → 'submitted' / 'failed' / 'needs_attention'.
  status: {
    type: DataTypes.ENUM(
      'scouting',         // just discovered, score queued
      'pending',          // scored but prep hasn't started
      'preparing',        // prep worker is running
      'prepared',         // waiting on human (or auto-approval)
      'rejected',         // human said no
      'approved',         // human said yes; enqueued for submission
      'submitting',       // submit worker is sending
      'submitted',        // ATS accepted the application
      'needs_attention',  // submit worker hit a CAPTCHA / unknown field
      'failed',           // submit worker errored and gave up
      'error'             // legacy value, kept for back-compat
    ),
    // 'pending' is the first state actually consumed by the prep pipeline.
    // 'scouting' is kept in the enum for back-compat / UI grouping but is
    // not a default — rows created without an explicit status would otherwise
    // be stuck because no worker transitions out of 'scouting'.
    defaultValue: 'pending',
  },

  // Prepared artifacts. Each field is nullable so a partially-prepared
  // app can still show up in "preparing" state on the dashboard.
  tailoredResume: { type: DataTypes.JSONB, defaultValue: null },
  //   { summaryOld, summaryNew, experienceDiff: [{old,new}], added: [], newSkills: [] }
  coverLetter: { type: DataTypes.TEXT, allowNull: true },
  formAnswers: { type: DataTypes.JSONB, defaultValue: [] },
  //   [{ fieldId, question, answer, confidence }]

  // Why the agent picked this job — shown in the Review "Why these changes?" box.
  whyPicked: { type: DataTypes.TEXT, allowNull: true },

  // Audit trail for activity feed.
  scoutedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  preparedAt: { type: DataTypes.DATE, allowNull: true },
  approvedAt: { type: DataTypes.DATE, allowNull: true },
  submittedAt: { type: DataTypes.DATE, allowNull: true },
  rejectedAt: { type: DataTypes.DATE, allowNull: true },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true },
  // Employer-driven outcome state captured from inbox classification.
  // e.g. interview_invite | rejection | offer | withdrawn
  outcomeType: { type: DataTypes.STRING, allowNull: true },
  // Normalized reason category used to improve future scouting quality.
  // e.g. location | salary | experience_gap
  outcomeReasonCategory: { type: DataTypes.STRING, allowNull: true },
  outcomeReason: { type: DataTypes.TEXT, allowNull: true },
  outcomeMeta: { type: DataTypes.JSONB, allowNull: true, defaultValue: null },
  errorMessage: { type: DataTypes.TEXT, allowNull: true },

  // ---- Submission artifacts & telemetry (Phase 1 auto-submit) ----

  // Which ATS adapter handled (or will handle) this submission.
  // Set by the worker when it dispatches. Values: 'greenhouse' | 'lever' |
  // 'ashby' | 'workday' | 'generic' | null (no URL / unknown).
  atsProvider: { type: DataTypes.STRING, allowNull: true },

  // Optional explicit credential to use for this application. When set,
  // the submit worker calls getDecryptedCredentialById(); otherwise it
  // falls back to provider-based lookup (most-recent active credential).
  // Used when the user has multiple accounts for the same provider —
  // e.g. two Greenhouse accounts on different boards.
  credentialId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'ApplyPilotCredentials', key: 'id' },
    onDelete: 'SET NULL',
  },

  // URL of the rendered resume PDF we actually uploaded to the ATS.
  // Lives in Cloudinary (raw resource) so the candidate can re-download it.
  submittedPdfUrl: { type: DataTypes.TEXT, allowNull: true },

  // Whatever the ATS gave back on a successful POST — confirmation id,
  // redirect URL, raw response body. Opaque shape, indexed for debugging.
  //   { ok: true, provider: 'greenhouse', confirmationId?, raw?, fetchedAt }
  submissionReceipt: { type: DataTypes.JSONB, allowNull: true },

  // Filled on failure/needs_attention so the Review UI can show why it
  // paused and offer a "finish manually" link.
  submissionError: { type: DataTypes.TEXT, allowNull: true },
  // Legacy single-screenshot field kept for back-compat. The ordered
  // list below is what the Puppeteer adapter writes now.
  submissionScreenshot: { type: DataTypes.TEXT, allowNull: true },

  // Ordered list of screenshots captured during submission — one per
  // step the Puppeteer adapter takes (form loaded, filled, post-submit).
  // Each entry: { url, label, capturedAt }
  //
  //   [
  //     { url: 'https://…/step-1.png', label: 'Form loaded',     capturedAt: '…' },
  //     { url: 'https://…/step-2.png', label: 'Form filled',     capturedAt: '…' },
  //     { url: 'https://…/step-3.png', label: 'Confirmation',    capturedAt: '…' },
  //   ]
  //
  // Stored in Cloudinary (public folder so the candidate's browser can
  // load them without extra auth) — see resumePdf.js for the upload
  // helper pattern.
  submissionScreenshotUrls: { type: DataTypes.JSONB, defaultValue: [] },

  // How many times the worker has attempted a submit for this row.
  // Used for retry backoff and to stop an infinite bounce on failure.
  submitAttempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastSubmitAttemptAt: { type: DataTypes.DATE, allowNull: true },

  // How many times the prep worker has attempted to tailor this row.
  // Mirrors submitAttempts so transient AI failures don't loop forever.
  prepAttempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastPrepAttemptAt: { type: DataTypes.DATE, allowNull: true },

  // ---- Hybrid manual-submit pivot ----
  //
  // ApplyPilot prepares tailored materials and the candidate submits
  // manually on the employer's site. These columns capture what
  // happens after they leave: the timestamp they marked the row as
  // applied, their human-tracked pipeline status, and any free-form
  // notes (e.g. recruiter name, interview round outcome).

  // Set when the user clicks "Mark as applied" in the UI. Stays null
  // for rows the candidate hasn't acted on yet.
  manuallyAppliedAt: { type: DataTypes.DATE, allowNull: true },

  // Candidate-driven pipeline. Independent of `status` (which is the
  // prep/auto-submit machinery's view) so we don't conflate "agent
  // finished prep" with "candidate has heard back".
  trackingStatus: {
    type: DataTypes.ENUM(
      'not_applied',
      'applied',
      'interviewing',
      'offer',
      'hired',
      'rejected_by_company',
      'withdrawn'
    ),
    defaultValue: 'not_applied',
    allowNull: false,
  },

  // Free-form notes the candidate jots down while tracking — recruiter
  // contact info, interview feedback, salary discussions. Plain text,
  // surfaced verbatim in the UI.
  trackingNotes: { type: DataTypes.TEXT, allowNull: true },

  // Cached snapshot of the apply form's fields, harvested read-only by
  // the ATS adapter so the review UI can show the candidate exactly
  // what they'll be asked to fill in. Shape mirrors what
  // harvestFieldsFromDom returns:
  //   [{ fieldId, question, type, required, options?, placeholder? }]
  formFieldsScanned: { type: DataTypes.JSONB, defaultValue: null },
  formFieldsScannedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  timestamps: true,
  tableName: 'ApplyPilotApplications',
  indexes: [
    { fields: ['userId'], name: 'idx_applypilot_app_user' },
    { fields: ['status'], name: 'idx_applypilot_app_status' },
    { fields: ['userId', 'status'], name: 'idx_applypilot_app_user_status' },
    { fields: ['userId', 'jobId'], name: 'idx_applypilot_app_user_job' },
    // Idempotency: scout (and manual create) must never produce two
    // ApplyPilotApplication rows for the same user + job pair. We use
    // partial unique indexes so the constraint only applies when the
    // foreign-key column is non-null (the model has both jobId and
    // externalJobId, exactly one of which is set per row).
    {
      name: 'uq_applypilot_app_user_external_job',
      unique: true,
      fields: ['userId', 'externalJobId'],
      where: { externalJobId: { [Op.ne]: null } },
    },
    {
      name: 'uq_applypilot_app_user_internal_job',
      unique: true,
      fields: ['userId', 'jobId'],
      where: { jobId: { [Op.ne]: null } },
    },
  ],
});

module.exports = ApplyPilotApplication;
