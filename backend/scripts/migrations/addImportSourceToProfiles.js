/**
 * Migration: Add Import Source Fields to Profiles
 * 
 * Adds fields to track where profiles came from (CSV, LinkedIn, email, etc.)
 * 
 * Run: node scripts/migrations/addImportSourceToProfiles.js
 */

const { sequelize } = require('../../models');

async function up() {
  console.log('🚀 Starting migration: Add Import Source to Profiles\n');
  
  try {
    // Check if importSource column already exists
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Profiles' AND column_name = 'importSource';
    `);
    
    if (results.length > 0) {
      console.log('⚠️  importSource column already exists. Skipping...\n');
      return true;
    }
    
    // Create the ENUM type first (if it doesn't exist)
    console.log('📦 Creating import source ENUM type...');
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_Profiles_importSource" AS ENUM (
          'manual', 'csv', 'linkedin', 'email', 'ats', 'api', 'referral'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('   ✓ ENUM type created\n');
    
    // Add the new columns
    console.log('📝 Adding new columns to Profiles table...');
    
    await sequelize.query(`
      ALTER TABLE "Profiles" 
      ADD COLUMN IF NOT EXISTS "importSource" "enum_Profiles_importSource" DEFAULT 'manual' NOT NULL;
    `);
    console.log('   ✓ Added importSource column');
    
    await sequelize.query(`
      ALTER TABLE "Profiles" 
      ADD COLUMN IF NOT EXISTS "importedAt" TIMESTAMP WITH TIME ZONE;
    `);
    console.log('   ✓ Added importedAt column');
    
    await sequelize.query(`
      ALTER TABLE "Profiles" 
      ADD COLUMN IF NOT EXISTS "importBatchId" UUID;
    `);
    console.log('   ✓ Added importBatchId column');
    
    // Add foreign key constraint for importBatchId
    console.log('\n🔗 Adding foreign key constraint...');
    await sequelize.query(`
      DO $$ BEGIN
        ALTER TABLE "Profiles" 
        ADD CONSTRAINT "fk_profiles_import_batch" 
        FOREIGN KEY ("importBatchId") 
        REFERENCES "CandidateImports"("id") 
        ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('   ✓ Foreign key added');
    
    // Create indexes
    console.log('\n📊 Creating indexes...');
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_profiles_import_source" 
      ON "Profiles"("importSource");
    `);
    console.log('   ✓ Index on importSource');
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_profiles_import_batch" 
      ON "Profiles"("importBatchId");
    `);
    console.log('   ✓ Index on importBatchId');
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_profiles_imported_at" 
      ON "Profiles"("importedAt");
    `);
    console.log('   ✓ Index on importedAt');
    
    // Add comments
    console.log('\n💬 Adding column comments...');
    
    await sequelize.query(`
      COMMENT ON COLUMN "Profiles"."importSource" IS 
        'How this profile was created: manual, csv, linkedin, email, ats, api, referral';
    `);
    
    await sequelize.query(`
      COMMENT ON COLUMN "Profiles"."importedAt" IS 
        'Timestamp when profile was imported (null for manual creation)';
    `);
    
    await sequelize.query(`
      COMMENT ON COLUMN "Profiles"."importBatchId" IS 
        'Reference to CandidateImports batch if this profile was imported';
    `);
    
    console.log('   ✓ Comments added\n');
    
    console.log('✅ Migration completed successfully!\n');
    console.log('Summary:');
    console.log('  - Added importSource ENUM column (default: manual)');
    console.log('  - Added importedAt timestamp column');
    console.log('  - Added importBatchId UUID column with FK');
    console.log('  - Created 3 indexes for query performance\n');
    
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

async function down() {
  console.log('🔄 Rolling back: Remove Import Source from Profiles\n');
  
  try {
    // Drop foreign key constraint first
    await sequelize.query(`
      ALTER TABLE "Profiles" 
      DROP CONSTRAINT IF EXISTS "fk_profiles_import_batch";
    `);
    console.log('   ✓ Dropped foreign key constraint');
    
    // Drop indexes
    await sequelize.query('DROP INDEX IF EXISTS "idx_profiles_import_source";');
    await sequelize.query('DROP INDEX IF EXISTS "idx_profiles_import_batch";');
    await sequelize.query('DROP INDEX IF EXISTS "idx_profiles_imported_at";');
    console.log('   ✓ Dropped indexes');
    
    // Drop columns
    await sequelize.query('ALTER TABLE "Profiles" DROP COLUMN IF EXISTS "importSource";');
    await sequelize.query('ALTER TABLE "Profiles" DROP COLUMN IF EXISTS "importedAt";');
    await sequelize.query('ALTER TABLE "Profiles" DROP COLUMN IF EXISTS "importBatchId";');
    console.log('   ✓ Dropped columns');
    
    // Drop ENUM type
    await sequelize.query('DROP TYPE IF EXISTS "enum_Profiles_importSource";');
    console.log('   ✓ Dropped ENUM type');
    
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
