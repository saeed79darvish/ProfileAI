/**
 * Backfill embeddings for all existing profiles
 * 
 * Run: node scripts/backfillEmbeddings.js
 * 
 * Generates Voyage AI embeddings for all profiles that don't have one yet.
 * Processes in batches with rate limiting to respect API limits.
 */

require('dotenv').config();

if (!process.env.VOYAGE_API_KEY) {
  console.error('✗ VOYAGE_API_KEY is not set in .env');
  process.exit(1);
}

const sequelize = require('../config/database');
const Profile = require('../models/Profile');
const { embeddingService } = require('../services/embeddingService');

async function backfillEmbeddings() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('✓ Connected\n');

    // Count profiles needing embeddings
    const [countResult] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE embedding IS NULL) as needs_embedding,
        COUNT(*) FILTER (WHERE embedding IS NOT NULL) as has_embedding
      FROM "Profiles";
    `);
    
    const stats = countResult[0];
    console.log(`Total profiles: ${stats.total}`);
    console.log(`Already embedded: ${stats.has_embedding}`);
    console.log(`Needs embedding: ${stats.needs_embedding}\n`);

    if (parseInt(stats.needs_embedding) === 0) {
      console.log('✅ All profiles already have embeddings!');
      process.exit(0);
    }

    // Fetch profiles without embeddings
    const profiles = await Profile.findAll({
      where: sequelize.literal('embedding IS NULL'),
      order: [['createdAt', 'DESC']]
    });

    console.log(`Processing ${profiles.length} profiles...\n`);

    const BATCH_SIZE = 50; // Process 50 at a time
    let totalSuccess = 0;
    let totalFailed = 0;

    for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
      const batch = profiles.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(profiles.length / BATCH_SIZE);

      console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} profiles)...`);

      const result = await embeddingService.generateBatchEmbeddings(batch);
      totalSuccess += result.success;
      totalFailed += result.failed;

      console.log(`  ✓ Success: ${result.success}, Failed: ${result.failed}`);

      // Rate limiting between batches
      if (i + BATCH_SIZE < profiles.length) {
        console.log('  Waiting 500ms...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`\n${'='.repeat(40)}`);
    console.log(`Backfill complete!`);
    console.log(`  Embedded: ${totalSuccess}`);
    console.log(`  Failed: ${totalFailed}`);
    console.log(`  Total: ${totalSuccess + totalFailed}`);

    // Final count
    const [finalCount] = await sequelize.query(`
      SELECT COUNT(*) FILTER (WHERE embedding IS NOT NULL) as embedded 
      FROM "Profiles";
    `);
    console.log(`\nProfiles with embeddings: ${finalCount[0].embedded}`);
    console.log('✅ Done!');

    process.exit(0);
  } catch (error) {
    console.error('✗ Backfill failed:', error);
    process.exit(1);
  }
}

backfillEmbeddings();
