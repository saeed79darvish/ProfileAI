/**
 * Backfill embeddings for all ExternalJobs that don't have one.
 * 
 * Usage: cd backend && node scripts/backfillJobEmbeddings.js
 * 
 * Uses OpenAI text-embedding-3-small (512d).
 * Cost estimate: ~11k jobs × ~200 tokens each ≈ 2.2M tokens ≈ $0.04
 */

require('dotenv').config();
const sequelize = require('../config/database');
const { ExternalJob } = require('../models');
const { generateBatchJobEmbeddings } = require('../services/jobEmbeddingService');

async function backfill() {
  console.log('[Backfill] Starting job embedding backfill...');

  // First, ensure the embedding column exists
  try {
    await sequelize.query(`
      ALTER TABLE "ExternalJobs" 
      ADD COLUMN IF NOT EXISTS embedding vector(512),
      ADD COLUMN IF NOT EXISTS "embeddingUpdatedAt" TIMESTAMPTZ
    `);
    console.log('[Backfill] Ensured embedding columns exist');
  } catch (err) {
    // Column might already exist
    console.log('[Backfill] Column check:', err.message);
  }

  // Count jobs without embeddings
  const [countResult] = await sequelize.query(
    `SELECT COUNT(*) as count FROM "ExternalJobs" WHERE "isActive" = true AND embedding IS NULL`
  );
  const total = parseInt(countResult[0].count);
  console.log(`[Backfill] ${total} active jobs need embeddings`);

  if (total === 0) {
    console.log('[Backfill] All jobs already have embeddings. Done!');
    process.exit(0);
  }

  // Process in chunks — always query jobs without embeddings
  const CHUNK_SIZE = 500;
  let totalSuccess = 0;
  let totalFailed = 0;

  while (true) {
    // Query jobs that still need embeddings
    const [rows] = await sequelize.query(
      `SELECT id, title, company, department, location, "locationType", 
              "experienceLevel", skills, requirements, description
       FROM "ExternalJobs" 
       WHERE "isActive" = true AND embedding IS NULL
       ORDER BY "postedAt" DESC
       LIMIT $1`,
      { bind: [CHUNK_SIZE] }
    );

    if (rows.length === 0) break;

    const { success, failed } = await generateBatchJobEmbeddings(rows);
    totalSuccess += success;
    totalFailed += failed;

    const remaining = total - totalSuccess - totalFailed;
    const pct = Math.round(((totalSuccess + totalFailed) / total) * 100);
    console.log(`[Backfill] Progress: ${pct}% — ${totalSuccess} embedded, ${totalFailed} failed, ~${remaining} remaining`);
  }

  console.log(`\n[Backfill] Complete! ${totalSuccess} embedded, ${totalFailed} failed out of ${total} total.`);
  process.exit(0);
}

backfill().catch(err => {
  console.error('[Backfill] Fatal error:', err);
  process.exit(1);
});
