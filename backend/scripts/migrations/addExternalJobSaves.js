/**
 * Migration: Make SavedJob polymorphic (Job OR ExternalJob)
 *
 * Before this migration, the SavedJob.jobId column was NOT NULL and
 * foreign-keyed only to the platform Jobs table. External-job saves had
 * no place to live, so the frontend stored them in localStorage — meaning
 * saves were lost on logout, browser clear, or device switch.
 *
 * After this migration:
 *   - jobId is nullable
 *   - externalJobId column added (nullable, FK to ExternalJobs)
 *   - DB-level CHECK constraint enforces that exactly one of jobId /
 *     externalJobId is set per row
 *   - The unique index on (userId, jobId) becomes a partial index that
 *     only applies when jobId IS NOT NULL
 *   - A matching partial unique index is added for (userId, externalJobId)
 *
 * Run: node scripts/migrations/addExternalJobSaves.js
 *
 * Idempotent — safe to re-run.
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('🚀 Starting migration: Polymorphic SavedJob (Job OR ExternalJob)\n');

  try {
    // 1. Make jobId nullable
    console.log('📦 Step 1: Making "jobId" nullable...');
    await sequelize.query(`
      ALTER TABLE "SavedJobs"
      ALTER COLUMN "jobId" DROP NOT NULL;
    `);
    console.log('   ✓ jobId is now nullable');

    // 2. Add externalJobId column (idempotent via IF NOT EXISTS)
    console.log('📦 Step 2: Adding "externalJobId" column...');
    await sequelize.query(`
      ALTER TABLE "SavedJobs"
      ADD COLUMN IF NOT EXISTS "externalJobId" UUID
      REFERENCES "ExternalJobs"("id") ON DELETE CASCADE;
    `);
    console.log('   ✓ externalJobId column added');

    // 3. Drop the old non-partial unique index (safe to drop even if absent)
    console.log('📦 Step 3: Dropping old unique index on (userId, jobId)...');
    await sequelize.query(`
      DROP INDEX IF EXISTS "saved_jobs_user_job_unique";
    `);
    console.log('   ✓ Old index dropped');

    // 4. Recreate as a partial unique index — only applies when jobId IS NOT NULL
    console.log('📦 Step 4: Creating partial unique index on (userId, jobId)...');
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "saved_jobs_user_job_unique"
      ON "SavedJobs" ("userId", "jobId")
      WHERE "jobId" IS NOT NULL;
    `);
    console.log('   ✓ Partial unique index created');

    // 5. Partial unique index for (userId, externalJobId)
    console.log('📦 Step 5: Creating partial unique index on (userId, externalJobId)...');
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "saved_jobs_user_external_unique"
      ON "SavedJobs" ("userId", "externalJobId")
      WHERE "externalJobId" IS NOT NULL;
    `);
    console.log('   ✓ Partial unique index created');

    // 6. CHECK constraint — exactly one of jobId / externalJobId must be set
    //    (We DROP first to keep the migration idempotent.)
    console.log('📦 Step 6: Adding CHECK constraint (exactly one target)...');
    await sequelize.query(`
      ALTER TABLE "SavedJobs"
      DROP CONSTRAINT IF EXISTS "saved_jobs_exactly_one_target";
    `);
    await sequelize.query(`
      ALTER TABLE "SavedJobs"
      ADD CONSTRAINT "saved_jobs_exactly_one_target"
      CHECK (
        (("jobId" IS NOT NULL)::int + ("externalJobId" IS NOT NULL)::int) = 1
      );
    `);
    console.log('   ✓ CHECK constraint added');

    console.log('\n✅ Migration completed successfully\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  }
}

async function down() {
  console.log('🔙 Reverting: Polymorphic SavedJob\n');
  try {
    await sequelize.query(`ALTER TABLE "SavedJobs" DROP CONSTRAINT IF EXISTS "saved_jobs_exactly_one_target";`);
    await sequelize.query(`DROP INDEX IF EXISTS "saved_jobs_user_external_unique";`);
    await sequelize.query(`DROP INDEX IF EXISTS "saved_jobs_user_job_unique";`);
    await sequelize.query(`ALTER TABLE "SavedJobs" DROP COLUMN IF EXISTS "externalJobId";`);
    // Restore the original (non-partial) unique index. Note: this will
    // FAIL if any rows have jobId IS NULL — caller must clean those first.
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "saved_jobs_user_job_unique"
      ON "SavedJobs" ("userId", "jobId");
    `);
    await sequelize.query(`ALTER TABLE "SavedJobs" ALTER COLUMN "jobId" SET NOT NULL;`);
    console.log('✅ Revert completed\n');
  } catch (error) {
    console.error('\n❌ Revert failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  const direction = process.argv[2] === 'down' ? down : up;
  direction()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { up, down };
