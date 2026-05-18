const sequelize = require('../config/database');

async function addViewsColumn() {
  try {
    console.log('🔄 Adding views column to Posts table...');
    
    await sequelize.query(`
      ALTER TABLE "Posts" 
      ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
    `);
    
    console.log('✅ Views column added successfully');
    
    // Update all existing posts to have 0 views
    await sequelize.query(`
      UPDATE "Posts" 
      SET views = 0 
      WHERE views IS NULL;
    `);
    
    console.log('✅ Initialized views to 0 for all existing posts');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addViewsColumn();
