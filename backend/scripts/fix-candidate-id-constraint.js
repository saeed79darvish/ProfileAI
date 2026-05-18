// Fix candidateId to allow NULL in JobApplications table
const sequelize = require('../config/database');

async function fix() {
  await sequelize.authenticate();
  console.log('Connected');
  
  // Check current constraint
  const [before] = await sequelize.query(
    `SELECT column_name, is_nullable FROM information_schema.columns 
     WHERE table_name = 'JobApplications' AND column_name = 'candidateId'`
  );
  console.log('Before:', JSON.stringify(before));
  
  // Fix: allow NULL on candidateId
  await sequelize.query('ALTER TABLE "JobApplications" ALTER COLUMN "candidateId" DROP NOT NULL');
  console.log('Fixed: candidateId now allows NULL');
  
  // Also add the unique index on trackingCode if not exists
  try {
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "job_applications_tracking_code_unique" 
      ON "JobApplications" ("trackingCode") 
      WHERE "trackingCode" IS NOT NULL
    `);
    console.log('Added unique index on trackingCode');
  } catch (e) {
    console.log('Index may already exist:', e.message);
  }
  
  // Verify
  const [after] = await sequelize.query(
    `SELECT column_name, is_nullable FROM information_schema.columns 
     WHERE table_name = 'JobApplications' AND column_name = 'candidateId'`
  );
  console.log('After:', JSON.stringify(after));
  
  process.exit(0);
}

fix().catch(e => { console.error(e); process.exit(1); });
