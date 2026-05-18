/**
 * Enable pgvector extension and create HNSW index on Profiles.embedding
 * 
 * Run: node scripts/enablePgvector.js
 * 
 * This script:
 * 1. Enables the pgvector extension in PostgreSQL
 * 2. Adds the embedding column if it doesn't exist
 * 3. Creates an HNSW index for fast cosine similarity search
 */

require('dotenv').config();
const sequelize = require('../config/database');

async function enablePgvector() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('✓ Connected');

    // Step 1: Enable pgvector extension
    console.log('\nEnabling pgvector extension...');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✓ pgvector extension enabled');

    // Step 2: Add embedding column if not exists
    console.log('\nAdding embedding column to Profiles...');
    await sequelize.query(`
      ALTER TABLE "Profiles" 
      ADD COLUMN IF NOT EXISTS embedding vector(512);
    `);
    console.log('✓ embedding column added (512 dimensions)');

    // Step 3: Add embeddingUpdatedAt column if not exists
    console.log('Adding embeddingUpdatedAt column...');
    await sequelize.query(`
      ALTER TABLE "Profiles" 
      ADD COLUMN IF NOT EXISTS "embeddingUpdatedAt" TIMESTAMP WITH TIME ZONE;
    `);
    console.log('✓ embeddingUpdatedAt column added');

    // Step 4: Create HNSW index for fast cosine similarity search
    console.log('\nCreating HNSW index on embedding column...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS profile_embedding_hnsw_idx 
      ON "Profiles" 
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `);
    console.log('✓ HNSW index created (cosine similarity)');

    // Verify
    console.log('\nVerifying setup...');
    const [extensions] = await sequelize.query(
      `SELECT * FROM pg_extension WHERE extname = 'vector';`
    );
    console.log('✓ pgvector extension:', extensions.length > 0 ? 'installed' : 'NOT FOUND');

    const [columns] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Profiles' 
      AND column_name IN ('embedding', 'embeddingUpdatedAt');
    `);
    console.log('✓ Columns found:', columns.map(c => c.column_name).join(', '));

    const [indexes] = await sequelize.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'Profiles' 
      AND indexname = 'profile_embedding_hnsw_idx';
    `);
    console.log('✓ HNSW index:', indexes.length > 0 ? 'created' : 'NOT FOUND');

    console.log('\n✅ pgvector setup complete! Ready for RAG-powered search.');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ pgvector setup failed:', error.message);
    console.error('\nMake sure pgvector is installed in your PostgreSQL:');
    console.error('  brew install pgvector  (macOS)');
    console.error('  apt install postgresql-16-pgvector  (Ubuntu)');
    console.error('Then restart PostgreSQL and run this script again.');
    process.exit(1);
  }
}

enablePgvector();
