/**
 * Migration: create guest-analyzer + analytics tables
 *
 * Prod skips sequelize.sync (see server.js), so brand-new tables for the
 * guest LinkedIn Profile Analyzer flow (GuestAIUsages, GuestAnalysisCaches,
 * GuestLeads) and the in-house AnalyticsEvents log must be created
 * explicitly. Idempotent CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT
 * EXISTS — safe to re-run on every boot.
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('[GuestAnalyzer] Ensuring tables exist...');

  // ── GuestAIUsages ────────────────────────────────────────────────────
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "GuestAIUsages" (
      "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "ipHash"            VARCHAR(64) NOT NULL,
      "profileUrlKey"     VARCHAR(500) NOT NULL,
      "analysisCacheId"   UUID,
      "emailCaptured"     BOOLEAN NOT NULL DEFAULT FALSE,
      "cacheHit"          BOOLEAN NOT NULL DEFAULT FALSE,
      "userAgent"         VARCHAR(500),
      "createdAt"         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt"         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "guest_ai_usages_iphash_createdat"
      ON "GuestAIUsages" ("ipHash", "createdAt");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "guest_ai_usages_urlkey_createdat"
      ON "GuestAIUsages" ("profileUrlKey", "createdAt");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "guest_ai_usages_analysiscacheid"
      ON "GuestAIUsages" ("analysisCacheId");
  `);

  // ── GuestAnalysisCaches ──────────────────────────────────────────────
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "GuestAnalysisCaches" (
      "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "cacheKey"              VARCHAR(600) NOT NULL,
      "profileUrlKey"         VARCHAR(500) NOT NULL,
      "scrapedPayloadHash"    VARCHAR(64) NOT NULL,
      "analysisJson"          JSONB NOT NULL,
      "targetTitle"           VARCHAR(255),
      "modelUsed"             VARCHAR(100),
      "producedByUserId"      UUID,
      "expiresAt"             TIMESTAMP WITH TIME ZONE NOT NULL,
      "createdAt"             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt"             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "guest_analysis_caches_cachekey_unique"
      ON "GuestAnalysisCaches" ("cacheKey");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "guest_analysis_caches_urlkey"
      ON "GuestAnalysisCaches" ("profileUrlKey");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "guest_analysis_caches_expiresat"
      ON "GuestAnalysisCaches" ("expiresAt");
  `);

  // ── GuestLeads ───────────────────────────────────────────────────────
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "GuestLeads" (
      "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "email"             VARCHAR(320) NOT NULL,
      "emailNormalized"   VARCHAR(320) NOT NULL,
      "profileUrlKey"     VARCHAR(500) NOT NULL,
      "analysisCacheId"   UUID,
      "ipHash"            VARCHAR(64),
      "unsubscribeToken"  VARCHAR(500),
      "emailedAt"         TIMESTAMP WITH TIME ZONE,
      "emailDeliveryOk"   BOOLEAN,
      "unsubscribed"      BOOLEAN NOT NULL DEFAULT FALSE,
      "convertedToUser"   BOOLEAN NOT NULL DEFAULT FALSE,
      "convertedUserId"   UUID,
      "convertedAt"       TIMESTAMP WITH TIME ZONE,
      "createdAt"         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt"         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "guest_leads_email_norm"
      ON "GuestLeads" ("emailNormalized");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "guest_leads_urlkey"
      ON "GuestLeads" ("profileUrlKey");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "guest_leads_analysiscacheid"
      ON "GuestLeads" ("analysisCacheId");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "guest_leads_converted"
      ON "GuestLeads" ("convertedToUser");
  `);
  // Dedupe: at most one row per (email, day). Uses functional index on
  // (emailNormalized, date_trunc('day', createdAt)) — Postgres enforces
  // via a partial unique.
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "guest_leads_email_day_unique"
      ON "GuestLeads" ("emailNormalized", (date_trunc('day', "createdAt")));
  `);

  // ── AnalyticsEvents ──────────────────────────────────────────────────
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "AnalyticsEvents" (
      "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "name"         VARCHAR(100) NOT NULL,
      "sessionId"    VARCHAR(64),
      "userId"       UUID,
      "properties"   JSONB DEFAULT '{}'::jsonb,
      "ipHash"       VARCHAR(64),
      "createdAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updatedAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "analytics_events_name_createdat"
      ON "AnalyticsEvents" ("name", "createdAt");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "analytics_events_sessionid"
      ON "AnalyticsEvents" ("sessionId");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "analytics_events_userid"
      ON "AnalyticsEvents" ("userId");
  `);

  console.log('[GuestAnalyzer] Tables ensured.');
}

module.exports = { up };
