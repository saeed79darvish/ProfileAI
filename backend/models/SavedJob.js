const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * SavedJob is polymorphic: a save references EITHER a platform `Job`
 * (recruiter-posted) OR an `ExternalJob` (aggregated from an ATS).
 * Exactly one of jobId / externalJobId is set per row — enforced both at
 * the model level (validate) and via a DB-level CHECK constraint added
 * by scripts/migrations/addExternalJobSaves.js.
 */
const SavedJob = sequelize.define('SavedJob', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  jobId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Jobs',
      key: 'id'
    }
  },
  externalJobId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'ExternalJobs',
      key: 'id'
    }
  }
}, {
  tableName: 'SavedJobs',
  timestamps: true,
  indexes: [
    // Partial unique indexes — one row per (user, jobId) and per
    // (user, externalJobId), without imposing uniqueness on NULLs.
    {
      unique: true,
      fields: ['userId', 'jobId'],
      name: 'saved_jobs_user_job_unique',
      where: { jobId: { [require('sequelize').Op.ne]: null } }
    },
    {
      unique: true,
      fields: ['userId', 'externalJobId'],
      name: 'saved_jobs_user_external_unique',
      where: { externalJobId: { [require('sequelize').Op.ne]: null } }
    }
  ],
  validate: {
    exactlyOneTarget() {
      const hasJob = this.jobId != null;
      const hasExt = this.externalJobId != null;
      if (hasJob === hasExt) {
        throw new Error('SavedJob must reference exactly one of jobId or externalJobId');
      }
    }
  }
});

module.exports = SavedJob;
