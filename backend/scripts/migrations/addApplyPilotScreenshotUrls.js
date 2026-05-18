/**
 * Migration: Add submissionScreenshotUrls to ApplyPilotApplications.
 *
 * Phase B of the Agent Arena redesign adds a Puppeteer-based adapter
 * that captures an ordered list of screenshots per submission attempt
 * (form loaded → form filled → post-submit confirmation). This column
 * stores those URLs so the Review / Sent tabs can render a mini
 * timeline with thumbnails.
 *
 * Shape of the JSON column:
 *   [
 *     { url: 'https://…/step-1.png', label: 'Form loaded',  capturedAt: '2026-04-19T…' },
 *     { url: 'https://…/step-2.png', label: 'Form filled',  capturedAt: '2026-04-19T…' },
 *     { url: 'https://…/step-3.png', label: 'Confirmation', capturedAt: '2026-04-19T…' }
 *   ]
 *
 * Run:    node scripts/migrations/addApplyPilotScreenshotUrls.js
 * Rollback: node scripts/migrations/addApplyPilotScreenshotUrls.js down
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('Migration · Add submissionScreenshotUrls to ApplyPilotApplications\n');

  try {
    const [results] = await sequelize.query(`
      SELECT column_name
        FROM information_schema.columns
       WHERE table_name = 'ApplyPilotApplications'
         AND column_name = 'submissionScreenshotUrls';
    `);

    if (results.length > 0) {
      console.log('   ⚠  submissionScreenshotUrls already exists. Skipping.\n');
      return true;
    }

    await sequelize.query(`
      ALTER TABLE "ApplyPilotApplications"
      ADD COLUMN IF NOT EXISTS "submissionScreenshotUrls" JSONB DEFAULT '[]'::jsonb NOT NULL;
    `);
    console.log('   ✓ Column added (JSONB, default [])');

    await sequelize.query(`
      COMMENT ON COLUMN "ApplyPilotApplications"."submissionScreenshotUrls" IS
        'Ordered list of { url, label, capturedAt } screenshots captured during submission by the Puppeteer-based ATS adapter.';
    `);
    console.log('   ✓ Column comment added');

    console.log('\nDone.\n');
    return true;
  } catch (err) {
    console.error('Migration failed:', err.message);
    throw err;
  }
}

async function down() {
  console.log('Rollback · Remove submissionScreenshotUrls from ApplyPilotApplications\n');
  try {
    await sequelize.query(`
      ALTER TABLE "ApplyPilotApplications"
      DROP COLUMN IF EXISTS "submissionScreenshotUrls";
    `);
    console.log('   ✓ Column dropped.\n');
    return true;
  } catch (err) {
    console.error('Rollback failed:', err.message);
    throw err;
  }
}

async function run() {
  const command = process.argv[2];
  try {
    await sequelize.authenticate();
    console.log('Database connected\n');
    if (command === 'down') await down();
    else await up();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
