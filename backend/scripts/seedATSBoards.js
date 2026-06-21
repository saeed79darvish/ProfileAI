/**
 * Seed script to pre-configure popular company ATS boards.
 * Usage: cd backend && node scripts/seedATSBoards.js
 */
require('dotenv').config();
const { sequelize, ATSBoard } = require('../models');
const { syncAllBoards } = require('../services/externalJobService');
const { SEED_BOARDS } = require('../config/seedBoards');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Add new ENUM values for PostgreSQL (safe — IF NOT EXISTS)
    try {
      await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'remoteok'`);
      await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'adzuna'`);
      await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'jsearch'`);
      await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'theirstack'`);
      await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'ashby'`);
      await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'wwr'`);
      await sequelize.query(`ALTER TYPE "enum_ATSBoards_platform" ADD VALUE IF NOT EXISTS 'hn_hiring'`);
      await sequelize.query(`ALTER TYPE "enum_ExternalJobs_source" ADD VALUE IF NOT EXISTS 'jsearch'`);
      await sequelize.query(`ALTER TYPE "enum_ExternalJobs_source" ADD VALUE IF NOT EXISTS 'theirstack'`);
      await sequelize.query(`ALTER TYPE "enum_ExternalJobs_source" ADD VALUE IF NOT EXISTS 'ashby'`);
      await sequelize.query(`ALTER TYPE "enum_ExternalJobs_source" ADD VALUE IF NOT EXISTS 'wwr'`);
      await sequelize.query(`ALTER TYPE "enum_ExternalJobs_source" ADD VALUE IF NOT EXISTS 'hn_hiring'`);
      console.log('Platform ENUM values updated.');
    } catch (e) {
      // ENUM values may already exist or table may not exist yet
      console.log('ENUM update skipped (may already exist):', e.message);
    }

    // Schema sync is OPT-IN. On production we manage schema via migrations
    // (npm run init-db) — do not silently alter columns on every seed.
    // Set SEED_ALLOW_SCHEMA_SYNC=true to enable for local/dev only.
    if (process.env.SEED_ALLOW_SCHEMA_SYNC === 'true') {
      console.log('SEED_ALLOW_SCHEMA_SYNC=true → running sequelize.sync({ alter: true })');
      await sequelize.sync({ alter: true });
    } else {
      console.log('Skipping sequelize.sync (set SEED_ALLOW_SCHEMA_SYNC=true to enable).');
    }

    let created = 0;
    let skipped = 0;

    for (const board of SEED_BOARDS) {
      const [, wasCreated] = await ATSBoard.findOrCreate({
        where: { platform: board.platform, boardToken: board.boardToken },
        defaults: { name: board.name, isActive: true }
      });
      if (wasCreated) {
        created++;
        console.log(`  + ${board.name} (${board.platform}/${board.boardToken})`);
      } else {
        skipped++;
        console.log(`  ~ ${board.name} already exists, skipped`);
      }
    }

    console.log(`\nSeeded ${created} boards (${skipped} already existed).`);

    // Run initial sync
    console.log('\nRunning initial sync for all boards...');
    const result = await syncAllBoards();
    console.log(`Sync complete: ${result.totalJobs} total jobs across ${result.boardsSynced} boards.`);

    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
