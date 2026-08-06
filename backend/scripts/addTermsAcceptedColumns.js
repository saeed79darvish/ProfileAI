#!/usr/bin/env node
/**
 * Add termsAccepted and termsAcceptedAt columns to Users table.
 *
 * Usage:
 *   node scripts/addTermsAcceptedColumns.js
 *   node scripts/addTermsAcceptedColumns.js --dry-run
 */

require('dotenv').config();
const { sequelize } = require('../models');

const dryRun = process.argv.includes('--dry-run');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Connected to database');

    // Check if columns already exist
    const [result] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Users'
        AND column_name IN ('termsAccepted', 'termsAcceptedAt');
    `);

    if (result.length === 2) {
      console.log('✓ Columns already exist');
      process.exit(0);
    }

    const queries = [];

    // Add termsAccepted if missing
    if (!result.some(r => r.column_name === 'termsAccepted')) {
      queries.push(`
        ALTER TABLE "Users"
        ADD COLUMN "termsAccepted" BOOLEAN NOT NULL DEFAULT false;
      `);
    }

    // Add termsAcceptedAt if missing
    if (!result.some(r => r.column_name === 'termsAcceptedAt')) {
      queries.push(`
        ALTER TABLE "Users"
        ADD COLUMN "termsAcceptedAt" TIMESTAMP WITH TIME ZONE;
      `);
    }

    if (queries.length === 0) {
      console.log('✓ All columns already exist');
      process.exit(0);
    }

    if (dryRun) {
      console.log('Dry run — would execute:');
      queries.forEach(q => console.log(q));
      process.exit(0);
    }

    for (const query of queries) {
      console.log('Executing:', query.trim());
      await sequelize.query(query);
    }

    console.log('✓ Successfully added termsAccepted columns');
    process.exit(0);
  } catch (err) {
    console.error('✗ Failed:', err.message);
    process.exit(1);
  }
})();
