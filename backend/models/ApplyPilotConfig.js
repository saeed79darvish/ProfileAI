const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * ApplyPilotConfig — one row per candidate.
 * Stores everything the four AgentArena setup steps ask for so the
 * scout / prep / submit workers can read it without hitting the UI.
 */
const ApplyPilotConfig = sequelize.define('ApplyPilotConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE',
  },

  // High-level run state. Workers check this before picking up a user's
  // jobs so pausing is instant.
  state: {
    type: DataTypes.ENUM('idle', 'running', 'paused'),
    defaultValue: 'idle',
  },

  // Step 2 — Criteria (dollars, match%, pacing)
  // Stored as JSONB so the shape can evolve without a migration.
  //   {
  //     salaryFloorK: number,   // e.g. 160 → $160k
  //     matchThreshold: number, // 0–100
  //     dailyLimit: number,
  //     reapplyCooldownDays: number,
  //     answerConfidence: number,
  //   }
  criteria: { type: DataTypes.JSONB, defaultValue: {} },

  // Step 3 — Approval mode. 'auto' sends without review; 'review' queues
  // prepared applications for human approval.
  approval: {
    type: DataTypes.ENUM('auto', 'review'),
    defaultValue: 'review',
  },

  // Step 4 — Safety rails
  //   { humanPacing: boolean, uniqueContent: boolean, blockedCompanies: string[] }
  rails: { type: DataTypes.JSONB, defaultValue: {} },

  // EEO / demographic answers — collected in setup step 5.
  // Stored here (per-user) so every application can reference them
  // without duplicating on each row. Shape:
  //   {
  //     genderIdentity: string | null,
  //     transgender: string | null,
  //     sexualOrientation: string | null,
  //     disability: string | null,
  //     veteran: string | null,
  //     ethnicity: string[] | null,
  //     workAuthorization: string | null,
  //     sponsorship: string | null,
  //   }
  demographics: {
    type: DataTypes.JSONB,
    defaultValue: {
      workAuthorization: null,
      sponsorship: null,
      genderIdentity: null,
      transgender: null,
      sexualOrientation: null,
      disability: null,
      veteran: null,
      ethnicity: null,
    },
  },

  // Candidate submission profile — normalized contact and logistics data.
  profile: {
    type: DataTypes.JSONB,
    defaultValue: {
      fullName: null,
      email: null,
      phone: null,
      linkedinUrl: null,
      githubUrl: null,
      portfolioUrl: null,
      currentLocation: null,
      relocationWillingness: null,
      noticePeriod: null,
      salaryExpectation: null,
    },
  },

  // Cached training progress — updated when the coach completes a topic.
  //   { overallPct: number, topics: [{ key, pct, variant }] }
  trainingCoverage: { type: DataTypes.JSONB, defaultValue: {} },

  // Last scout-cycle funnel snapshot. Written at the end of every
  // scoutForUser() run so the dashboard can explain *why* the queue is
  // empty instead of saying "the pilot is watching" forever. Shape:
  //   {
  //     ranAt: ISO string,
  //     eligible: number,          // jobs that survived the criteria filter
  //     surfaced: number,          // jobs inserted as ApplyPilotApplications
  //     above: number,             // jobs that cleared matchThreshold
  //     below: number,             // jobs below threshold
  //     fallback: number,          // jobs surfaced via fallback floor
  //     noUrl: number,             // jobs dropped because no apply URL
  //     threshold: number,         // user's matchThreshold at run time
  //     dailyCount: number,        // applications already created today
  //     dailyLimit: number,        // user's daily cap
  //     reason: string,            // one of: surfaced | no_profile |
  //                                //   daily_limit_hit | no_eligible_jobs |
  //                                //   all_below_threshold | no_apply_url
  //   }
  lastScoutRun: { type: DataTypes.JSONB, allowNull: true, defaultValue: null },

  lastStartedAt: { type: DataTypes.DATE, allowNull: true },
  lastPausedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  timestamps: true,
  tableName: 'ApplyPilotConfigs',
  indexes: [
    { fields: ['userId'], unique: true, name: 'idx_applypilot_config_user' },
    { fields: ['state'], name: 'idx_applypilot_config_state' },
  ],
});

module.exports = ApplyPilotConfig;
