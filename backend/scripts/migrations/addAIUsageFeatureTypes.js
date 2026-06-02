/**
 * Migration: Add missing values to the AIUsages.featureType ENUM.
 *
 * Context: Several routes call recordAIUsage(userId, '<featureType>') with
 * values that were never added to enum_AIUsages_featureType, so every such
 * insert fails in prod with:
 *   invalid input value for enum "enum_AIUsages_featureType": "analyze_gaps"
 * The AI feature itself still returns 200, but usage tracking + rate limiting
 * silently break for these features. Missing values found in the codebase:
 *   - analyze_gaps          (routes/profiles.js  /analyze-gaps)
 *   - generate_answers      (routes/profiles.js  /generate-answers)
 *   - generate_cover_letter (routes/profiles.js  /generate-cover-letter)
 *   - job_enhance           (routes/jobs.js      /ai/*)
 *
 * Postgres ENUMs require ALTER TYPE ... ADD VALUE; this is idempotent via
 * IF NOT EXISTS (Postgres 9.6+).
 *
 * Run: node scripts/migrations/addAIUsageFeatureTypes.js
 */

const { sequelize } = require('../../models');

const NEW_VALUES = [
  'analyze_gaps',
  'generate_answers',
  'generate_cover_letter',
  'job_enhance',
];

async function up() {
  console.log('🚀 Adding missing values to enum_AIUsages_featureType\n');

  // Resolve the actual enum type name for AIUsages.featureType rather than
  // hard-coding it, so this keeps working if the type is ever renamed.
  const [rows] = await sequelize.query(`
    SELECT t.typname AS enum_name
    FROM pg_type t
    JOIN pg_attribute a ON a.atttypid = t.oid
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'AIUsages' AND a.attname = 'featureType' AND t.typtype = 'e'
    LIMIT 1;
  `);

  if (!rows.length) {
    console.log('   ⚠️  AIUsages.featureType ENUM not found — nothing to do.');
    return;
  }

  const enumName = rows[0].enum_name;
  for (const value of NEW_VALUES) {
    // ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so each
    // runs as its own statement. IF NOT EXISTS makes it safe to re-run.
    await sequelize.query(`ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}';`);
    console.log(`   ✓ ${value} ensured on ${enumName}`);
  }

  console.log('\n✅ Done.');
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { up };
