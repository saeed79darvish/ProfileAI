/**
 * Migration: Add Users.linkedinId column.
 *
 * Context: The User model now declares linkedinId (STRING, nullable, unique) to
 * support LinkedIn "Sign in with LinkedIn using OpenID Connect" — the auth
 * routes POST /api/auth/linkedin and POST /api/auth/linkedin/register both
 * run `User.findOne({ where: { linkedinId } })` to link the LinkedIn `sub`
 * identifier back to an existing account. Production skips sequelize.sync,
 * so without this migration every LinkedIn sign-in attempt returns 500 with
 * `column "linkedinId" does not exist`.
 *
 * Matches the shape of googleId/githubId (both STRING, nullable, unique).
 *
 * ADD COLUMN IF NOT EXISTS is purely additive and idempotent, so it's safe
 * to run on every boot. The partial unique index is added separately so the
 * migration doesn't error if a legacy index already exists.
 *
 * Run: node scripts/migrations/ensureUserLinkedinId.js
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('🚀 Ensuring Users.linkedinId column exists\n');

  await sequelize.query(`
    ALTER TABLE "Users"
    ADD COLUMN IF NOT EXISTS "linkedinId" VARCHAR(255);
  `);
  console.log('   ✓ Users.linkedinId column ensured');

  // Enforce uniqueness the same way Sequelize would have on sync. Uses a
  // partial index so multiple users without a LinkedIn link (NULL) don't
  // collide — matches the googleId/githubId semantics.
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "users_linkedin_id_unique"
    ON "Users" ("linkedinId")
    WHERE "linkedinId" IS NOT NULL;
  `);
  console.log('   ✓ Users.linkedinId unique index ensured');

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
