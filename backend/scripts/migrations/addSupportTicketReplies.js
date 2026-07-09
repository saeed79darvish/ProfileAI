/**
 * Migration: add SupportTickets.replies column.
 *
 * A conversation thread between admins and the user on the same ticket.
 * Each entry: { by:'admin'|'user', adminId?, body, createdAt }.
 *
 * Idempotent ALTER TABLE ADD COLUMN IF NOT EXISTS \u2014 safe to re-run.
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('[SupportTickets] Ensuring replies column exists...');
  await sequelize.query(`
    ALTER TABLE "SupportTickets"
      ADD COLUMN IF NOT EXISTS "replies" JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);
  console.log('[SupportTickets] replies column ensured');
}

module.exports = { up };

if (require.main === module) {
  up()
    .then(() => { console.log('Done'); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
}
