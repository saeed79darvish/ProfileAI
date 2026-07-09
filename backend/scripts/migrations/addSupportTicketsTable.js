/**
 * Migration: create SupportTickets table
 *
 * Prod skips sequelize.sync (see server.js), so a brand-new table for a
 * brand-new model (SupportTicket) has to be created explicitly by an
 * idempotent CREATE TABLE IF NOT EXISTS. This mirrors the pattern used by
 * addCandidateImportTables.js, addExternalJobSaves.js, etc.
 *
 * Safe to run on every boot — every statement uses IF NOT EXISTS.
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('[SupportTickets] Ensuring table exists...');

  // Enum types first (Postgres requires them before column creation).
  await sequelize.query(`
    DO $$ BEGIN
      CREATE TYPE "enum_SupportTickets_category" AS ENUM
        ('bug', 'feature', 'billing', 'account', 'question', 'other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await sequelize.query(`
    DO $$ BEGIN
      CREATE TYPE "enum_SupportTickets_status" AS ENUM
        ('open', 'in_progress', 'resolved', 'closed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "SupportTickets" (
      "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId"         UUID REFERENCES "Users"("id") ON DELETE SET NULL,
      "email"          VARCHAR(255) NOT NULL,
      "name"           VARCHAR(255),
      "category"       "enum_SupportTickets_category" NOT NULL DEFAULT 'question',
      "subject"        VARCHAR(255) NOT NULL,
      "message"        TEXT NOT NULL,
      "chatTranscript" JSONB,
      "status"         "enum_SupportTickets_status" NOT NULL DEFAULT 'open',
      "adminNotes"     TEXT,
      "resolvedAt"     TIMESTAMP WITH TIME ZONE,
      "source"         VARCHAR(50) NOT NULL DEFAULT 'help_center',
      "metadata"       JSONB,
      "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_support_tickets_status"
      ON "SupportTickets"("status");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_support_tickets_user"
      ON "SupportTickets"("userId");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_support_tickets_created"
      ON "SupportTickets"("createdAt" DESC);
  `);

  console.log('[SupportTickets] Table ensured');
}

module.exports = { up };

if (require.main === module) {
  up()
    .then(() => { console.log('Done'); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
}
