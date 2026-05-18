/**
 * Migration: Add 'pro_plus' to the Subscriptions.planType ENUM.
 *
 * Context: We are restructuring the candidate plans from
 *   free | pro | enterprise   →   free | pro | pro_plus
 * Existing 'enterprise' rows are kept for legacy users; new signups go to
 * 'pro_plus'. Postgres ENUMs require ALTER TYPE ... ADD VALUE; this is
 * idempotent thanks to IF NOT EXISTS (Postgres 9.6+).
 *
 * Run: node scripts/migrations/addProPlusToSubscriptionEnum.js
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('🚀 Adding pro_plus to plan-related ENUMs\n');

  // Helper: look up the actual enum type name for a column, then ADD VALUE.
  const addValueToColumnEnum = async (table, column) => {
    const [rows] = await sequelize.query(`
      SELECT t.typname AS enum_name
      FROM pg_type t
      JOIN pg_attribute a ON a.atttypid = t.oid
      JOIN pg_class c ON c.oid = a.attrelid
      WHERE c.relname = $1 AND a.attname = $2 AND t.typtype = 'e'
      LIMIT 1;
    `, { bind: [table, column] });

    if (!rows.length) {
      console.log(`   ⚠️  ${table}.${column} ENUM not found — skipping`);
      return;
    }
    const enumName = rows[0].enum_name;
    await sequelize.query(`ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS 'pro_plus';`);
    console.log(`   ✓ pro_plus added to ${enumName} (${table}.${column})`);
  };

  await addValueToColumnEnum('Subscriptions', 'planType');
  await addValueToColumnEnum('Users', 'subscriptionTier');

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
