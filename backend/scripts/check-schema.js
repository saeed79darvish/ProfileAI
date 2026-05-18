const db = require('../models');

async function check() {
  const [cols] = await db.sequelize.query(
    `SELECT column_name, data_type, udt_name 
     FROM information_schema.columns 
     WHERE table_name = 'JobApplications' 
     AND column_name IN ('trackingCode','parsedResumeData','guestEmail','guestName','screeningConsent','screeningConsentAt','importedCandidateId') 
     ORDER BY column_name`
  );
  console.log('JobApplication new columns:', JSON.stringify(cols, null, 2));

  const [cols2] = await db.sequelize.query(
    `SELECT column_name, data_type, udt_name 
     FROM information_schema.columns 
     WHERE table_name = 'CandidateInvitations' 
     AND column_name = 'submissionType'`
  );
  console.log('\nCandidateInvitation submissionType:', JSON.stringify(cols2, null, 2));

  const [enums] = await db.sequelize.query(
    `SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) as values 
     FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid 
     WHERE t.typname LIKE '%JobApplications%' OR t.typname LIKE '%CandidateInvitations_submissionType%' 
     GROUP BY t.typname`
  );
  console.log('\nENUMs:', JSON.stringify(enums, null, 2));

  process.exit(0);
}

check().catch(e => { console.error(e.message); process.exit(1); });
