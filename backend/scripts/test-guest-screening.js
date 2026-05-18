/**
 * Test script for Guest Screening Pipeline
 * 
 * Run: node scripts/test-guest-screening.js
 */
const sequelize = require('../config/database');
const { 
  CandidateInvitation, CandidateImport, ImportedCandidate, 
  Job, User, JobApplication 
} = require('../models');
const crypto = require('crypto');

async function checkSchema() {
  console.log('\n=== 1. SCHEMA CHECK ===');
  
  // Check JobApplication columns
  const [jaResult] = await sequelize.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'JobApplications' ORDER BY ordinal_position"
  );
  const jaCols = jaResult.map(r => r.column_name);
  console.log('JobApplications columns:', jaCols.join(', '));
  
  const newFields = ['trackingCode', 'guestEmail', 'guestName', 'importedCandidateId', 'screeningConsent', 'parsedResumeData'];
  for (const f of newFields) {
    const present = jaCols.includes(f);
    console.log(`  ${present ? '✓' : '✗'} ${f}: ${present ? 'EXISTS' : 'MISSING'}`);
  }
  
  // Check status enum
  try {
    const [enumResult] = await sequelize.query(
      "SELECT unnest(enum_range(NULL::\"enum_JobApplications_status\")) as val"
    );
    const statuses = enumResult.map(r => r.val);
    console.log('\nJobApplication statuses:', statuses.join(', '));
    console.log('  Has pending_screening:', statuses.includes('pending_screening') ? '✓' : '✗');
  } catch (e) {
    console.log('Could not check enum (may need server restart with alter:true):', e.message);
  }
  
  // Check CandidateInvitation
  try {
    const [ciEnum] = await sequelize.query(
      "SELECT unnest(enum_range(NULL::\"enum_CandidateInvitations_status\")) as val"
    );
    const ciStatuses = ciEnum.map(r => r.val);
    console.log('\nCandidateInvitation statuses:', ciStatuses.join(', '));
    console.log('  Has submitted:', ciStatuses.includes('submitted') ? '✓' : '✗');
  } catch (e) {
    console.log('Could not check CandidateInvitation enum:', e.message);
  }
  
  return jaCols;
}

async function createTestData() {
  console.log('\n=== 2. CREATE TEST DATA ===');
  
  // Find a job and its recruiter
  const job = await Job.findOne({ 
    include: [{ model: User, as: 'recruiter' }],
    where: { status: 'active' }
  });
  if (!job) {
    // Try any job
    const anyJob = await Job.findOne({ include: [{ model: User, as: 'recruiter' }] });
    if (!anyJob) {
      console.log('✗ No jobs found. Create one first.');
      return null;
    }
    // Use this job
    var recruiter = anyJob.recruiter;
    var jobToUse = anyJob;
  } else {
    var recruiter = job.recruiter;
    var jobToUse = job;
  }
  if (!recruiter) {
    console.log('✗ No recruiter found for the job.');
    return null;
  }
  console.log('✓ Recruiter:', recruiter.firstName, recruiter.lastName, '(' + recruiter.email + ')');
  console.log('✓ Job:', jobToUse.title, 'at', jobToUse.company);
  
  // Create a CandidateImport batch (needed for ImportedCandidate)
  let importBatch = await CandidateImport.findOne({ where: { recruiterId: recruiter.id } });
  if (!importBatch) {
    importBatch = await CandidateImport.create({
      recruiterId: recruiter.id,
      jobId: jobToUse.id,
      source: 'manual',
      status: 'completed',
      totalRecords: 1,
      processedRecords: 1,
      successCount: 1,
      fileName: 'test-guest-screening.csv'
    });
    console.log('✓ Created import batch:', importBatch.id);
  } else {
    console.log('✓ Using existing import batch:', importBatch.id);
  }
  
  // Create an ImportedCandidate
  const testEmail = 'guest.test.' + Date.now() + '@example.com';
  const importedCandidate = await ImportedCandidate.create({
    importId: importBatch.id,
    firstName: 'Test',
    lastName: 'GuestCandidate',
    email: testEmail,
    currentTitle: 'Software Engineer',
    location: 'San Francisco, CA',
    importStatus: 'success',
    sourceData: { source: 'test-script' },
    enrichedData: {}
  });
  console.log('✓ Created ImportedCandidate:', importedCandidate.id);
  
  // Create a CandidateInvitation with token
  const token = crypto.randomBytes(32).toString('hex');
  const invitation = await CandidateInvitation.create({
    importId: importBatch.id,
    importedCandidateId: importedCandidate.id,
    jobId: jobToUse.id,
    recruiterId: recruiter.id,
    email: testEmail,
    firstName: 'Test',
    lastName: 'GuestCandidate',
    invitationToken: token,
    status: 'sent',
    sentAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
  console.log('✓ Created Invitation:', invitation.id);
  console.log('  Token:', token);
  
  return { recruiter, job: jobToUse, importBatch, importedCandidate, invitation, token, testEmail };
}

async function testEndpoints(testData) {
  console.log('\n=== 3. TEST API ENDPOINTS ===');
  
  const BASE_URL = 'http://localhost:5001/api/guest-screening';
  
  // Test GET /:token
  console.log('\n--- GET /:token ---');
  try {
    const res = await fetch(`${BASE_URL}/${testData.token}`);
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Success:', data.success);
    if (data.success) {
      console.log('  Job:', data.data.job?.title);
      console.log('  Candidate:', data.data.invitation.firstName, data.data.invitation.lastName);
      console.log('  Questions:', data.data.screeningQuestions?.length, 'questions');
      console.log('  Options:', JSON.stringify(data.data.options));
    } else {
      console.log('  Error:', data.error);
    }
  } catch (e) {
    console.log('✗ Failed:', e.message);
  }
  
  // Test POST /:token/submit (without resume, just answers)
  console.log('\n--- POST /:token/submit ---');
  try {
    const formData = new FormData();
    formData.append('answers', JSON.stringify({
      years_experience: '3-5 years',
      work_authorization: 'Yes',
      notice_period: '2 weeks',
      why_interested: 'Excited about the role and the company culture!'
    }));
    formData.append('consentToScreening', 'true');
    formData.append('consentToTerms', 'true');
    
    const res = await fetch(`${BASE_URL}/${testData.token}/submit`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Success:', data.success);
    if (data.success) {
      console.log('  Tracking Code:', data.data.trackingCode);
      console.log('  Next Steps:', data.data.nextSteps?.length, 'steps');
      
      // Save tracking code for next test
      testData.trackingCode = data.data.trackingCode;
    } else {
      console.log('  Error:', data.error);
      console.log('  Errors:', JSON.stringify(data.errors));
    }
  } catch (e) {
    console.log('✗ Failed:', e.message);
  }
  
  // Test GET /track/:code
  if (testData.trackingCode) {
    console.log('\n--- GET /track/:code ---');
    try {
      const res = await fetch(`${BASE_URL}/track/${testData.trackingCode}`);
      const data = await res.json();
      console.log('Status:', res.status);
      console.log('Success:', data.success);
      if (data.success) {
        console.log('  Status:', data.data.status, '|', data.data.statusLabel);
        console.log('  Job:', data.data.job?.title, 'at', data.data.job?.company);
        console.log('  Applicant:', data.data.applicantName);
      }
    } catch (e) {
      console.log('✗ Failed:', e.message);
    }
  }
  
  // Test duplicate submission (should fail)
  console.log('\n--- POST /:token/submit (duplicate - should fail) ---');
  try {
    const formData = new FormData();
    formData.append('answers', JSON.stringify({ years_experience: '1-2 years' }));
    formData.append('consentToScreening', 'true');
    formData.append('consentToTerms', 'true');
    
    const res = await fetch(`${BASE_URL}/${testData.token}/submit`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    console.log('Status:', res.status, '(expected 400)');
    console.log('Error:', data.error, '(expected "already been responded to")');
  } catch (e) {
    console.log('Result:', e.message);
  }
  
  // Verify DB state
  console.log('\n=== 4. VERIFY DB STATE ===');
  
  const updatedInvitation = await CandidateInvitation.findByPk(testData.invitation.id);
  console.log('Invitation status:', updatedInvitation.status, '(expected: submitted)');
  console.log('Submission type:', updatedInvitation.submissionType, '(expected: guest_screening)');
  console.log('Consent data:', updatedInvitation.consentData ? '✓ stored' : '✗ missing');
  
  if (testData.trackingCode) {
    const app = await JobApplication.findOne({ where: { trackingCode: testData.trackingCode } });
    if (app) {
      console.log('\nJobApplication found:');
      console.log('  Status:', app.status, '(expected: pending_screening)');
      console.log('  Source:', app.source, '(expected: guest_screening)');
      console.log('  CandidateId:', app.candidateId, '(expected: null)');
      console.log('  ImportedCandidateId:', app.importedCandidateId, '(expected: UUID)');
      console.log('  Guest email:', app.guestEmail);
      console.log('  Guest name:', app.guestName);
      console.log('  Screening consent:', app.screeningConsent);
      console.log('  Answers:', app.answers ? '✓ stored' : '✗ missing');
    } else {
      console.log('✗ No JobApplication found for tracking code');
    }
  }
  
  const updatedIC = await ImportedCandidate.findByPk(testData.importedCandidate.id);
  console.log('\nImportedCandidate enrichment:', updatedIC.enrichmentStatus, '(expected: completed)');
  console.log('  Enriched data has screeningAnswers:', !!updatedIC.enrichedData?.screeningAnswers);
}

async function cleanup(testData) {
  console.log('\n=== 5. CLEANUP ===');
  if (testData?.invitation) {
    if (testData.trackingCode) {
      await JobApplication.destroy({ where: { trackingCode: testData.trackingCode } });
    }
    // Also clean any application by importedCandidateId
    await JobApplication.destroy({ where: { importedCandidateId: testData.importedCandidate.id } });
    await CandidateInvitation.destroy({ where: { id: testData.invitation.id } });
    await ImportedCandidate.destroy({ where: { id: testData.importedCandidate.id } });
    console.log('✓ Cleaned up test data');
  }
}

async function main() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');
    
    const cols = await checkSchema();
    
    // Check if schema has new fields
    const hasNewFields = cols.includes('trackingCode') && cols.includes('guestEmail');
    if (!hasNewFields) {
      console.log('\n⚠️  New columns not yet in DB. Restart the server with alter:true to sync schema.');
      console.log('   Run: cd backend && node server.js');
      console.log('   (The server uses sequelize.sync({ alter: true }) in dev mode)');
      process.exit(1);
    }
    
    const testData = await createTestData();
    if (!testData) {
      console.log('\n⚠️  Cannot create test data. Ensure you have a recruiter with at least one job.');
      process.exit(1);
    }
    
    await testEndpoints(testData);
    await cleanup(testData);
    
    console.log('\n✅ All tests completed!');
    process.exit(0);
  } catch (e) {
    console.error('\n✗ Test failed:', e);
    process.exit(1);
  }
}

main();
