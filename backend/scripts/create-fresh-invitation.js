// Create a fresh invitation for browser testing
require('dotenv').config();
const crypto = require('crypto');
const db = require('../models');

(async () => {
  const job = await db.Job.findOne({ 
    where: { status: 'active' }, 
    include: [{ model: db.User, as: 'recruiter' }] 
  });
  
  const imp = await db.CandidateImport.findOne({ where: { recruiterId: job.userId } });
  
  const ic = await db.ImportedCandidate.create({
    importId: imp.id,
    firstName: 'Saeed',
    lastName: 'Darvish',
    email: 's79darvish@gmail.com',
    currentTitle: 'Senior Developer',
    currentCompany: 'TechStartup',
    location: 'San Francisco, CA',
    importStatus: 'success',
    sourceData: {},
    enrichedData: {}
  });

  const token = crypto.randomBytes(32).toString('hex');
  await db.CandidateInvitation.create({
    importId: imp.id,
    importedCandidateId: ic.id,
    jobId: job.id,
    recruiterId: job.userId,
    email: 's79darvish@gmail.com',
    firstName: 'Saeed',
    lastName: 'Darvish',
    invitationToken: token,
    status: 'sent',
    sentAt: new Date(),
    personalMessage: 'Hi Saeed, we loved your background and think you would be a perfect fit!',
    expiresAt: new Date(Date.now() + 7 * 86400000)
  });

  const url = `http://localhost:3000/screen/${token}`;
  console.log('\n✅ Fresh invitation created!');
  console.log(`\n🔗 Open in browser: ${url}\n`);
  process.exit(0);
})();
