/**
 * Migration: create guest-analyzer + analytics tables
 *
 * Prod skips sequelize.sync (see server.js), so brand-new tables for the
 * guest LinkedIn Profile Analyzer flow (GuestAIUsages, GuestAnalysisCaches,
 * GuestLeads) and the in-house AnalyticsEvents log must be created
 * explicitly. Idempotent CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT
 * EXISTS — safe to re-run on every boot.
 *
 * Every statement is wrapped in its own try/catch so a single problematic
 * ALTER/INDEX (e.g. an expression Postgres rejects as non-IMMUTABLE) can't
 * skip every subsequent statement in the file. Failures are logged, not
 * thrown.
 */

const { sequelize } = require('../../models');

async function safeRun(label, sql) {
  try {
    await sequelize.query(sql);
  } catch (err) {
    console.warn(`[GuestAnalyzer migration] ${label} skipped: ${err.message}`);
  }
}

async function up() {
  console.log('[GuestAnalyzer] Ensuring tables exist...');

  // ── GuestAIUsages ────────────────────────────────────────────────────
  await safeRun('GuestAIUsages CREATE TABLE', `
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
  await safeRun('GuestAIUsages iphash index', `
    CREATE INDEX IF NOT EXISTS "guest_ai_usages_iphash_createdat"
      ON "GuestAIUsages" ("ipHash", "createdAt");
  `);
  await safeRun('GuestAIUsages urlkey index', `
    CREATE INDEX IF NOT EXISTS "guest_ai_usages_urlkey_createdat"
      ON "GuestAIUsages" ("profileUrlKey", "createdAt");
  `);
  await safeRun('GuestAIUsages analysiscacheid index', `
    CREATE INDEX IF NOT EXISTS "guest_ai_usages_analysiscacheid"
      ON "GuestAIUsages" ("analysisCacheId");
  `);

  // ── GuestAnalysisCaches ──────────────────────────────────────────────
  await safeRun('GuestAnalysisCaches CREATE TABLE', `
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
  await safeRun('GuestAnalysisCaches cachekey unique', `
    CREATE UNIQUE INDEX IF NOT EXISTS "guest_analysis_caches_cachekey_unique"
      ON "GuestAnalysisCaches" ("cacheKey");
  `);
  await safeRun('GuestAnalysisCaches urlkey index', `
    CREATE INDEX IF NOT EXISTS "guest_analysis_caches_urlkey"
      ON "GuestAnalysisCaches" ("profileUrlKey");
  `);
  await safeRun('GuestAnalysisCaches expiresat index', `
    CREATE INDEX IF NOT EXISTS "guest_analysis_caches_expiresat"
      ON "GuestAnalysisCaches" ("expiresAt");
  `);

  // ── GuestLeads ───────────────────────────────────────────────────────
  await safeRun('GuestLeads CREATE TABLE', `
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
  await safeRun('GuestLeads email index', `
    CREATE INDEX IF NOT EXISTS "guest_leads_email_norm"
      ON "GuestLeads" ("emailNormalized");
  `);
  await safeRun('GuestLeads urlkey index', `
    CREATE INDEX IF NOT EXISTS "guest_leads_urlkey"
      ON "GuestLeads" ("profileUrlKey");
  `);
  await safeRun('GuestLeads analysiscacheid index', `
    CREATE INDEX IF NOT EXISTS "guest_leads_analysiscacheid"
      ON "GuestLeads" ("analysisCacheId");
  `);
  await safeRun('GuestLeads converted index', `
    CREATE INDEX IF NOT EXISTS "guest_leads_converted"
      ON "GuestLeads" ("convertedToUser");
  `);
  // Per-analysis dedupe index. We only reject a resend of the SAME
  // analysis to the same email. Analysing a different profile (or the
  // same profile with a different target role) produces a distinct
  // analysisCacheId and is allowed through. Replaces the earlier
  // per-day index which locked users out of legitimate re-analyses.
  await safeRun('GuestLeads drop old per-day unique', `
    DROP INDEX IF EXISTS "guest_leads_email_day_unique";
  `);
  await safeRun('GuestLeads per-analysis unique', `
    CREATE UNIQUE INDEX IF NOT EXISTS "guest_leads_email_analysis_unique"
      ON "GuestLeads" ("emailNormalized", "analysisCacheId");
  `);

  // ── AnalyticsEvents ──────────────────────────────────────────────────
  await safeRun('AnalyticsEvents CREATE TABLE', `
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
  await safeRun('AnalyticsEvents name index', `
    CREATE INDEX IF NOT EXISTS "analytics_events_name_createdat"
      ON "AnalyticsEvents" ("name", "createdAt");
  `);
  await safeRun('AnalyticsEvents sessionid index', `
    CREATE INDEX IF NOT EXISTS "analytics_events_sessionid"
      ON "AnalyticsEvents" ("sessionId");
  `);
  await safeRun('AnalyticsEvents userid index', `
    CREATE INDEX IF NOT EXISTS "analytics_events_userid"
      ON "AnalyticsEvents" ("userId");
  `);

  console.log('[GuestAnalyzer] Tables ensured.');
}

module.exports = { up };

