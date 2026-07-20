/**
 * Migration: create BookmarkletTokens table
 *
 * Prod skips sequelize.sync (see server.js), so a brand-new table for a
 * brand-new model (BookmarkletToken) has to be created explicitly by an
 * idempotent CREATE TABLE IF NOT EXISTS. Mirrors addSupportTicketsTable.js.
 *
 * Safe to run on every boot — every statement uses IF NOT EXISTS.
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('[BookmarkletTokens] Ensuring table exists...');

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "BookmarkletTokens" (
      "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId"          UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
      "tokenHash"       VARCHAR(255) NOT NULL,
      "label"           VARCHAR(255) NOT NULL DEFAULT 'Mobile bookmarklet',
      "lastUsedAt"      TIMESTAMP WITH TIME ZONE,
      "lastUsedOrigin"  VARCHAR(255),
      "revokedAt"       TIMESTAMP WITH TIME ZONE,
      "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_bookmarklet_tokens_hash"
      ON "BookmarkletTokens"("tokenHash");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_bookmarklet_tokens_user"
      ON "BookmarkletTokens"("userId");
  `);

  console.log('[BookmarkletTokens] Table ensured');
}

module.exports = { up };

if (require.main === module) {
  up()
    .then(() => { console.log('Done'); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
}
