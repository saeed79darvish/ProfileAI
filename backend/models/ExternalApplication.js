const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExternalApplication = sequelize.define('ExternalApplication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  // Job info scraped from the page
  jobTitle: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  company: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  jobUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'e.g. LinkedIn, Greenhouse, Lever, Workday',
  },
  // Application status
  // Ordered ladder — see services/applicationTrackingService.js, which owns the
  // transitions. 'clicked' and 'in_progress' sit BELOW 'applied' and must never
  // be counted as an application: a tap on "Apply Now" only tells us the user
  // opened the company's ATS, and an extension autofill only tells us they
  // started the form. Treating either as applied is what inflated applied
  // counts and badged jobs users never actually applied to.
  status: {
    type: DataTypes.ENUM(
      'clicked',
      'in_progress',
      'applied',
      'screening',
      'interviewing',
      'offer',
      'rejected',
      'withdrawn',
      'no_response'
    ),
    defaultValue: 'applied',
  },
  // Which signal justified the current status, for auditing and analytics:
  // click | extension_autofill | extension_submit | applypilot |
  // tailored_resume | user | import | legacy_pre_state_machine.
  confirmedBy: {
    type: DataTypes.STRING(40),
    allowNull: true,
  },
  confirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // jobUrl with tracking params stripped and the remainder canonically ordered
  // (utils/jobUrl.js). The in-app click stores the job's applyUrl while the
  // extension stores the browser URL; those differ by utm_*/ref/gh_src for the
  // SAME posting, so matching on the raw column let one application occupy two
  // rows. Never compute this inline — use normalizeJobUrl so stored keys and
  // lookup keys can never diverge.
  normalizedJobUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // When the row became a real application. NULL while it is only 'clicked' or
  // 'in_progress', so the UI never shows an "Applied <date>" for a job the user
  // merely opened.
  appliedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  // Optional metadata
  salary: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  jobType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'e.g. Full-time, Part-time, Contract',
  },
  locationType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'e.g. Remote, Hybrid, On-site',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // What was used to apply
  tailoredProfileId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'TailoredProfiles',
      key: 'id',
    },
  },
  resumeUsed: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  coverLetterUsed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // AI match data from extension
  matchScore: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 0, max: 100 },
  },
  // Direct link to the ExternalJob the user applied to, set when the row is
  // created from a click on an in-app external-job card ("Apply Now"). Gives an
  // EXACT match for the "Applied" badge instead of the fuzzy jobUrl comparison,
  // and survives tracking-param drift. Null for extension/manual rows that have
  // no corresponding ExternalJob in our corpus. Column added by
  // scripts/migrations/addExternalApplicationJobLink.js.
  externalJobId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'ExternalJobs',
      key: 'id',
    },
    onDelete: 'SET NULL',
  },
}, {
  tableName: 'ExternalApplications',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['status'] },
    { fields: ['appliedAt'] },
    { fields: ['userId', 'jobUrl'], unique: true },
    // Non-unique on purpose: pre-existing rows may already collide once
    // normalized (that IS the duplicate bug), so a unique constraint could fail
    // the migration and block a deploy. Dedup is enforced in
    // applicationTrackingService, which merges instead of rejecting.
    { fields: ['userId', 'normalizedJobUrl'] },
    // One application row per (user, externalJob). Partial so it only applies
    // to the click-tracked rows (externalJobId set); extension/manual rows with
    // NULL externalJobId are unaffected. Makes record-on-click idempotent.
    {
      unique: true,
      fields: ['userId', 'externalJobId'],
      name: 'external_applications_user_external_job_unique',
      where: { externalJobId: { [require('sequelize').Op.ne]: null } },
    },
  ],
});

module.exports = ExternalApplication;
