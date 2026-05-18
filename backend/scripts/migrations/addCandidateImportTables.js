/**
 * Migration: Add Bulk Candidate Import Tables
 * 
 * This migration creates two tables for managing bulk candidate imports:
 * 1. CandidateImports - Tracks import batches (CSV uploads, LinkedIn imports, etc.)
 * 2. ImportedCandidates - Tracks individual candidates within each import batch
 * 
 * Run: node scripts/migrations/addCandidateImportTables.js
 */

const { sequelize } = require('../../models');

async function up() {
  const queryInterface = sequelize.getQueryInterface();
  
  console.log('🚀 Starting migration: Add Candidate Import Tables\n');
  
  try {
    // ===========================================
    // 1. Create CandidateImports Table
    // ===========================================
    console.log('📦 Creating CandidateImports table...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "CandidateImports" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "jobId" UUID REFERENCES "Jobs"("id") ON DELETE SET NULL,
        "recruiterId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
        "importType" VARCHAR(20) NOT NULL DEFAULT 'csv' 
          CHECK ("importType" IN ('csv', 'linkedin', 'email', 'ats', 'api', 'manual')),
        "fileName" VARCHAR(255),
        "fileUrl" VARCHAR(500),
        "totalCandidates" INTEGER NOT NULL DEFAULT 0,
        "processedCandidates" INTEGER NOT NULL DEFAULT 0,
        "successfulImports" INTEGER NOT NULL DEFAULT 0,
        "failedImports" INTEGER NOT NULL DEFAULT 0,
        "duplicatesFound" INTEGER NOT NULL DEFAULT 0,
        "status" VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK ("status" IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
        "errorLog" JSONB DEFAULT '[]'::jsonb,
        "importOptions" JSONB DEFAULT '{}'::jsonb,
        "completedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('   ✓ Table created');
    
    // Create indexes for CandidateImports
    console.log('   Creating indexes...');
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_candidate_imports_recruiter" 
        ON "CandidateImports"("recruiterId");
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_candidate_imports_job" 
        ON "CandidateImports"("jobId");
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_candidate_imports_status" 
        ON "CandidateImports"("status");
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_candidate_imports_created" 
        ON "CandidateImports"("createdAt" DESC);
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_candidate_imports_type_status" 
        ON "CandidateImports"("importType", "status");
    `);
    
    console.log('   ✓ Indexes created\n');
    
    // ===========================================
    // 2. Create ImportedCandidates Table
    // ===========================================
    console.log('👤 Creating ImportedCandidates table...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "ImportedCandidates" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "importId" UUID NOT NULL REFERENCES "CandidateImports"("id") ON DELETE CASCADE,
        "profileId" UUID REFERENCES "Profiles"("id") ON DELETE SET NULL,
        "userId" UUID REFERENCES "Users"("id") ON DELETE SET NULL,
        "sourceData" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "firstName" VARCHAR(100),
        "lastName" VARCHAR(100),
        "email" VARCHAR(255),
        "phone" VARCHAR(50),
        "linkedinUrl" VARCHAR(500),
        "resumeUrl" VARCHAR(500),
        "currentTitle" VARCHAR(200),
        "currentCompany" VARCHAR(200),
        "location" VARCHAR(200),
        "enrichmentStatus" VARCHAR(20) NOT NULL DEFAULT 'none'
          CHECK ("enrichmentStatus" IN ('none', 'pending', 'in_progress', 'completed', 'failed')),
        "enrichedData" JSONB DEFAULT '{}'::jsonb,
        "enrichedAt" TIMESTAMP WITH TIME ZONE,
        "importStatus" VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK ("importStatus" IN ('pending', 'success', 'duplicate', 'invalid', 'failed')),
        "duplicateOfProfileId" UUID,
        "errorMessage" TEXT,
        "validationErrors" JSONB DEFAULT '[]'::jsonb,
        "sourceRowNumber" INTEGER,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('   ✓ Table created');
    
    // Create indexes for ImportedCandidates
    console.log('   Creating indexes...');
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_imported_candidates_import" 
        ON "ImportedCandidates"("importId");
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_imported_candidates_profile" 
        ON "ImportedCandidates"("profileId");
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_imported_candidates_user" 
        ON "ImportedCandidates"("userId");
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_imported_candidates_status" 
        ON "ImportedCandidates"("importStatus");
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_imported_candidates_enrichment" 
        ON "ImportedCandidates"("enrichmentStatus");
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_imported_candidates_email" 
        ON "ImportedCandidates"("email");
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_imported_candidates_linkedin" 
        ON "ImportedCandidates"("linkedinUrl");
    `);
    
    // Composite index for efficient duplicate checking
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_imported_candidates_dedup" 
        ON "ImportedCandidates"("email", "linkedinUrl", "importStatus");
    `);
    
    console.log('   ✓ Indexes created\n');
    
    // ===========================================
    // 3. Add comments for documentation
    // ===========================================
    console.log('📝 Adding table comments...');
    
    await sequelize.query(`
      COMMENT ON TABLE "CandidateImports" IS 
        'Tracks bulk candidate import batches from various sources (CSV, LinkedIn, ATS, etc.)';
    `);
    
    await sequelize.query(`
      COMMENT ON TABLE "ImportedCandidates" IS 
        'Individual candidate records from bulk imports, with enrichment and deduplication tracking';
    `);
    
    await sequelize.query(`
      COMMENT ON COLUMN "CandidateImports"."importType" IS 
        'Source type: csv, linkedin, email, ats, api, manual';
    `);
    
    await sequelize.query(`
      COMMENT ON COLUMN "CandidateImports"."status" IS 
        'Import status: pending, processing, completed, failed, cancelled';
    `);
    
    await sequelize.query(`
      COMMENT ON COLUMN "ImportedCandidates"."importStatus" IS 
        'Individual import status: pending, success, duplicate, invalid, failed';
    `);
    
    await sequelize.query(`
      COMMENT ON COLUMN "ImportedCandidates"."enrichmentStatus" IS 
        'Data enrichment status: none, pending, in_progress, completed, failed';
    `);
    
    console.log('   ✓ Comments added\n');
    
    console.log('✅ Migration completed successfully!\n');
    console.log('Summary:');
    console.log('  - Created CandidateImports table with 5 indexes');
    console.log('  - Created ImportedCandidates table with 8 indexes');
    console.log('  - Added foreign key constraints and check constraints');
    console.log('  - Added documentation comments\n');
    
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

async function down() {
  console.log('🔄 Rolling back: Removing Candidate Import Tables\n');
  
  try {
    // Drop tables in correct order (ImportedCandidates first due to FK)
    await sequelize.query('DROP TABLE IF EXISTS "ImportedCandidates" CASCADE;');
    console.log('   ✓ Dropped ImportedCandidates table');
    
    await sequelize.query('DROP TABLE IF EXISTS "CandidateImports" CASCADE;');
    console.log('   ✓ Dropped CandidateImports table');
    
    console.log('\n✅ Rollback completed successfully!\n');
    return true;
  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    throw error;
  }
}

// Run migration
async function run() {
  const command = process.argv[2];
  
  try {
    await sequelize.authenticate();
    console.log('📡 Database connected\n');
    
    if (command === 'down') {
      await down();
    } else {
      await up();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

run();
