/**
 * Migration: AIApiCalls, one row per provider call with real tokens and cost.
 * CREATE TABLE IF NOT EXISTS plus indexes: safe on every boot.
 */

const { sequelize } = require('../../models');

async function up() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "AIApiCalls" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid,
      "provider" varchar(20) NOT NULL,
      "model" varchar(80) NOT NULL,
      "operation" varchar(40) NOT NULL DEFAULT 'chat',
      "feature" varchar(60),
      "route" varchar(120),
      "inputTokens" integer NOT NULL DEFAULT 0,
      "outputTokens" integer NOT NULL DEFAULT 0,
      "cacheReadTokens" integer NOT NULL DEFAULT 0,
      "cacheWriteTokens" integer NOT NULL DEFAULT 0,
      "costUsd" numeric(12,6) NOT NULL DEFAULT 0,
      "priced" boolean NOT NULL DEFAULT true,
      "latencyMs" integer,
      "status" varchar(10) NOT NULL DEFAULT 'ok',
      "error" varchar(300),
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "ai_api_calls_created" ON "AIApiCalls" ("createdAt")`);
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "ai_api_calls_user_created" ON "AIApiCalls" ("userId", "createdAt")`);
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "ai_api_calls_model_created" ON "AIApiCalls" ("provider", "model", "createdAt")`);
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "ai_api_calls_feature_created" ON "AIApiCalls" ("feature", "createdAt")`);
  console.log('[AIApiCalls] table ensured');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
