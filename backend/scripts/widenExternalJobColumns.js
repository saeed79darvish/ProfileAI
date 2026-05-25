/**
 * Migration: widen ExternalJobs.{title,location,department} from VARCHAR(255)
 * to TEXT so boards like Flexport and Anduril (which return long titles /
 * locations) can be synced. Idempotent — safe to re-run.
 *
 * Usage (Render backend shell):
 *   node scripts/widenExternalJobColumns.js
 */
require('dotenv').config();
const { sequelize } = require('../models');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    const columns = ['title', 'location', 'department'];
    for (const col of columns) {
      console.log(`Widening "ExternalJobs"."${col}" to TEXT ...`);
      await sequelize.query(
        `ALTER TABLE "ExternalJobs" ALTER COLUMN "${col}" TYPE TEXT`
      );
      console.log(`  ✓ ${col}`);
    }

    console.log('\nDone. Re-run scripts/seedATSBoards.js to pick up Flexport/Anduril.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
