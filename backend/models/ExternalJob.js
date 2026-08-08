const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExternalJob = sequelize.define('ExternalJob', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  externalId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Unique ID from the source ATS (e.g., Greenhouse job ID, Lever posting ID)'
  },
  source: {
    type: DataTypes.ENUM('greenhouse', 'lever', 'ashby', 'remoteok', 'adzuna', 'jsearch', 'theirstack', 'wwr', 'manual', 'amazon', 'hn_hiring'),
    allowNull: false
  },
  boardToken: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'The company board token/slug used to fetch this job'
  },
  title: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  company: {
    type: DataTypes.STRING,
    allowNull: false
  },
  location: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  locationType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'remote, hybrid, onsite'
  },
  employmentType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'full-time, part-time, contract, internship'
  },
  experienceLevel: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'entry, mid, senior, lead, executive'
  },
  department: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  descriptionHtml: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  requirements: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  skills: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  // When skill extraction was last ATTEMPTED — not when skills were found.
  // An empty `skills` array alone can't distinguish "never tried" from "tried,
  // nothing extractable", so without this the backfill sweep would either
  // re-attempt unextractable jobs on every pass (paying for each) or abandon
  // jobs that hit a transient failure. Stamped on every attempt, success or not.
  skillsExtractedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // ── Ghost-job signals (services/ghostJobDetector.js) ────────────────────
  // A "ghost job" is a real company's real-looking posting that nobody is
  // actually hiring for: evergreen pipeline ads, roles left up after they were
  // filled, listings whose date is refreshed indefinitely. Distinct from the
  // fraud detection in jobScamDetector.js, which reads the TEXT for scam
  // patterns; these are behavioural signals that only emerge over time.
  //
  // 0-100. Scored, never used to delete: a slow-to-fill senior role can look
  // identical to a ghost, and the candidate cannot tell us when we guess wrong.
  // High scores demote in ranking and surface a hint instead.
  ghostScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Human-readable reasons behind the score, so a flag can always be explained
  // rather than being an unaccountable number.
  ghostReasons: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  // Age is a component of the score, so the score DECAYS INTO STALENESS on its
  // own — it has to be recomputed on a schedule, unlike a one-shot backfill.
  ghostCheckedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  salaryMin: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  salaryMax: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  salaryCurrency: {
    type: DataTypes.STRING,
    defaultValue: 'USD'
  },
  salaryPeriod: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'hourly, monthly, yearly, per-year-salary'
  },
  applyUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Direct URL to apply on the company ATS'
  },
  sourceUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'URL to view the job posting on the ATS'
  },
  postedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  effectivePostedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'DERIVED, DB-maintained: LEAST(COALESCE(postedAt, createdAt), createdAt) — '
      + 'the single date every feed query sorts and filters on. Never write this from '
      + 'application code; a BEFORE INSERT OR UPDATE trigger recomputes it on every write '
      + '(see scripts/migrations/ensureExternalJobPerfSchema.js). Bounding the source date '
      + 'by our own first sighting is what stops a Greenhouse bulk edit (which re-stamps '
      + 'updated_at) or a newly discovered board back-catalogue from flooding the top of '
      + 'the feed with jobs that are not actually new.'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastFetchedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Raw ATS response data for reference'
  },
  embedding: {
    type: DataTypes.VECTOR(512),
    allowNull: true,
    comment: 'OpenAI text-embedding-3-small vector for semantic search'
  },
  embeddingUpdatedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  isStartup: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Denormalized from the source ATSBoard.isStartup (set at ingest). Powers the "Startups" filter as a plain indexed boolean, avoiding a cross-enum ExternalJobs.source ↔ ATSBoards.platform join at query time. hn_hiring rows are also flagged true.'
  }
}, {
  tableName: 'ExternalJobs',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['source', 'externalId']
    },
    { fields: ['isActive'] },
    { fields: ['postedAt'] },
    { fields: ['source'] },
    { fields: ['company'] },
    { fields: ['boardToken'] },
    { fields: ['companyId'] }
  ]
});

module.exports = ExternalJob;
