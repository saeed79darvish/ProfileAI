/**
 * End-to-End Test: Full Guest Screening Pipeline with Real Email
 * 
 * Tests the COMPLETE flow:
 * 1. Creates test data (ImportedCandidate + CandidateInvitation)
 * 2. Sends the REAL invitation email (you'll receive it in your inbox)
 * 3. Tests GET /api/guest-screening/:token (load screening page)
 * 4. Tests POST /api/guest-screening/:token/submit (submit answers)
 * 5. Tests GET /api/guest-screening/track/:code (track application)
 * 6. Verifies all DB state
 * 7. Prints the URLs so you can test in browser
 * 
 * Run: cd backend && node scripts/test-e2e-guest-screening.js
 */
require('dotenv').config();
const crypto = require('crypto');
const {
  CandidateInvitation, CandidateImport, ImportedCandidate,
  Job, User, JobApplication, RecruiterProfile
} = require('../models');
const sequelize = require('../config/database');
const { sendInvitationEmail } = require('../services/invitationService');

const TEST_EMAIL = process.env.EMAIL_USER || 's79darvish@gmail.com';

async function run() {
  await sequelize.authenticate();
  console.log('✓ Database connected\n');

  // ────────────────────────────────────────
  // 1. SETUP TEST DATA
  // ────────────────────────────────────────
  console.log('═══════════════════════════════════════');
  console.log('  STEP 1: CREATE TEST DATA');
  console.log('═══════════════════════════════════════\n');

  // Find a job with its recruiter
  const job = await Job.findOne({
    where: { status: 'active' },
    include: [{ model: User, as: 'recruiter' }]
  }) || await Job.findOne({
    include: [{ model: User, as: 'recruiter' }]
  });

  if (!job) {
    console.log('✗ No jobs found. Create a job first.');
    process.exit(1);
  }

  const recruiter = job.recruiter;
  console.log(`  Recruiter: ${recruiter.firstName} ${recruiter.lastName} (${recruiter.email})`);
  console.log(`  Job: ${job.title} at ${job.company}`);
  console.log(`  Location: ${job.location || 'Remote'}`);
  if (job.salaryMin && job.salaryMax) {
    console.log(`  Salary: $${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`);
  }

  // Get or create import batch
  let importBatch = await CandidateImport.findOne({ where: { recruiterId: recruiter.id } });
  if (!importBatch) {
    importBatch = await CandidateImport.create({
      recruiterId: recruiter.id,
      jobId: job.id,
      source: 'manual',
      status: 'completed',
      totalRecords: 1,
      processedRecords: 1,
      successCount: 1,
      fileName: 'e2e-test.csv'
    });
  }
  console.log(`  Import batch: ${importBatch.id}`);

  // Create ImportedCandidate
  const importedCandidate = await ImportedCandidate.create({
    importId: importBatch.id,
    firstName: 'Saeed',
    lastName: 'Darvish',
    email: TEST_EMAIL,
    currentTitle: 'Senior Full-Stack Developer',
    currentCompany: 'TechCorp',
    location: 'San Francisco, CA',
    importStatus: 'success',
    sourceData: { source: 'e2e-test' },
    enrichedData: {}
  });
  console.log(`  ImportedCandidate: ${importedCandidate.id}`);

  // Create invitation with token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await CandidateInvitation.create({
    importId: importBatch.id,
    importedCandidateId: importedCandidate.id,
    jobId: job.id,
    recruiterId: recruiter.id,
    email: TEST_EMAIL,
    firstName: 'Saeed',
    lastName: 'Darvish',
    invitationToken: token,
    status: 'pending',
    personalMessage: 'We were impressed by your profile and think you\'d be a great fit for our team!',
    expiresAt,
    sentAt: null
  });
  console.log(`  Invitation ID: ${invitation.id}`);
  console.log(`  Token: ${token}`);
  console.log('');

  // ────────────────────────────────────────
  // 2. SEND THE REAL INVITATION EMAIL
  // ────────────────────────────────────────
  console.log('═══════════════════════════════════════');
  console.log('  STEP 2: SEND INVITATION EMAIL');
  console.log('═══════════════════════════════════════\n');

  // Load invitation with associations (same as sendInvitations does)
  const fullInvitation = await CandidateInvitation.findByPk(invitation.id, {
    include: [
      { model: Job, as: 'job' },
      {
        model: User,
        as: 'recruiter',
        include: [{ model: RecruiterProfile, as: 'recruiterProfile' }]
      }
    ]
  });

  try {
    await sendInvitationEmail(fullInvitation);
    console.log(`  ✅ Email sent to: ${TEST_EMAIL}`);
    console.log('  📧 Check your inbox!\n');

    // Update invitation status (as sendInvitations would)
    await invitation.update({
      status: 'sent',
      sentAt: new Date(),
      sendAttempts: 1
    });
  } catch (error) {
    console.log(`  ❌ Email failed: ${error.message}`);
    console.log('  Continuing with API tests...\n');
  }

  // ────────────────────────────────────────
  // 3. TEST GET /:token ENDPOINT
  // ────────────────────────────────────────
  console.log('═══════════════════════════════════════');
  console.log('  STEP 3: TEST GET /:token');
  console.log('═══════════════════════════════════════\n');

  const BASE_URL = 'http://localhost:5001/api/guest-screening';

  const getRes = await fetch(`${BASE_URL}/${token}`);
  const getData = await getRes.json();
  console.log(`  Status: ${getRes.status}`);
  console.log(`  Success: ${getData.success}`);
  if (getData.success) {
    console.log(`  Job: ${getData.data.job?.title} at ${getData.data.job?.company}`);
    console.log(`  Candidate: ${getData.data.invitation.firstName} ${getData.data.invitation.lastName}`);
    console.log(`  Recruiter: ${getData.data.recruiter?.name || 'N/A'}`);
    console.log(`  Questions: ${getData.data.screeningQuestions?.length} screening questions`);
    console.log(`  Options: signUp=${getData.data.options?.canSignUp}, guestSubmit=${getData.data.options?.canGuestSubmit}`);
    console.log(`  Sign-up URL: ${getData.data.options?.signUpUrl}`);
  } else {
    console.log(`  Error: ${getData.error}`);
  }
  console.log('');

  // ────────────────────────────────────────
  // 4. TEST POST /:token/submit ENDPOINT
  // ────────────────────────────────────────
  console.log('═══════════════════════════════════════');
  console.log('  STEP 4: TEST POST /:token/submit');
  console.log('═══════════════════════════════════════\n');

  const formData = new FormData();
  formData.append('answers', JSON.stringify({
    years_experience: '5+ years',
    work_authorization: 'Yes, authorized to work',
    notice_period: '2 weeks',
    salary_expectation: '$140,000 - $170,000',
    why_interested: 'I\'m passionate about building AI-powered products and your company\'s mission aligns perfectly with my career goals.',
    relevant_skills: 'React, Node.js, TypeScript, PostgreSQL, AI/ML integration',
    remote_preference: 'Hybrid (2-3 days in office)'
  }));
  formData.append('consentToScreening', 'true');
  formData.append('consentToTerms', 'true');

  const postRes = await fetch(`${BASE_URL}/${token}/submit`, {
    method: 'POST',
    body: formData
  });
  const postData = await postRes.json();
  console.log(`  Status: ${postRes.status}`);
  console.log(`  Success: ${postData.success}`);

  let trackingCode = null;
  if (postData.success) {
    trackingCode = postData.data.trackingCode;
    console.log(`  ✅ Tracking Code: ${trackingCode}`);
    console.log(`  Next steps: ${postData.data.nextSteps?.length} steps`);
    postData.data.nextSteps?.forEach((step, i) => console.log(`     ${i + 1}. ${step}`));
  } else {
    console.log(`  Error: ${postData.error}`);
  }
  console.log('');

  // ────────────────────────────────────────
  // 5. TEST GET /track/:code ENDPOINT
  // ────────────────────────────────────────
  if (trackingCode) {
    console.log('═══════════════════════════════════════');
    console.log('  STEP 5: TEST TRACKING');
    console.log('═══════════════════════════════════════\n');

    const trackRes = await fetch(`${BASE_URL}/track/${trackingCode}`);
    const trackData = await trackRes.json();
    console.log(`  Status: ${trackRes.status}`);
    console.log(`  Success: ${trackData.success}`);
    if (trackData.success) {
      console.log(`  Application Status: ${trackData.data.status}`);
      console.log(`  Status Label: ${trackData.data.statusLabel}`);
      console.log(`  Job: ${trackData.data.job?.title} at ${trackData.data.job?.company}`);
      console.log(`  Applicant: ${trackData.data.applicantName}`);
      console.log(`  Applied: ${trackData.data.appliedAt}`);
    }
    console.log('');
  }

  // ────────────────────────────────────────
  // 6. TEST DUPLICATE SUBMISSION
  // ────────────────────────────────────────
  console.log('═══════════════════════════════════════');
  console.log('  STEP 6: TEST DUPLICATE REJECTION');
  console.log('═══════════════════════════════════════\n');

  const dupForm = new FormData();
  dupForm.append('answers', JSON.stringify({ test: 'duplicate' }));
  dupForm.append('consentToScreening', 'true');
  dupForm.append('consentToTerms', 'true');

  const dupRes = await fetch(`${BASE_URL}/${token}/submit`, { method: 'POST', body: dupForm });
  const dupData = await dupRes.json();
  console.log(`  Status: ${dupRes.status} (expected: 400)`);
  console.log(`  Rejected: ${dupRes.status === 400 ? '✅' : '❌'} "${dupData.error}"`);
  console.log('');

  // ────────────────────────────────────────
  // 7. VERIFY DATABASE STATE
  // ────────────────────────────────────────
  console.log('═══════════════════════════════════════');
  console.log('  STEP 7: VERIFY DATABASE STATE');
  console.log('═══════════════════════════════════════\n');

  const updatedInvitation = await CandidateInvitation.findByPk(invitation.id);
  console.log('  CandidateInvitation:');
  console.log(`    Status: ${updatedInvitation.status} ${updatedInvitation.status === 'submitted' ? '✅' : '❌'}`);
  console.log(`    Submission Type: ${updatedInvitation.submissionType} ${updatedInvitation.submissionType === 'guest_screening' ? '✅' : '❌'}`);
  console.log(`    Consent Data: ${updatedInvitation.consentData ? '✅ stored' : '❌ missing'}`);
  console.log(`    Responded At: ${updatedInvitation.respondedAt || 'not set'}`);

  if (trackingCode) {
    const app = await JobApplication.findOne({ where: { trackingCode } });
    if (app) {
      console.log('\n  JobApplication:');
      console.log(`    Status: ${app.status} ${app.status === 'pending_screening' ? '✅' : '❌'}`);
      console.log(`    Source: ${app.source} ${app.source === 'guest_screening' ? '✅' : '❌'}`);
      console.log(`    CandidateId: ${app.candidateId} ${app.candidateId === null ? '✅ (null)' : '❌ (should be null)'}`);
      console.log(`    ImportedCandidateId: ${app.importedCandidateId} ${app.importedCandidateId ? '✅' : '❌'}`);
      console.log(`    Guest Email: ${app.guestEmail} ${app.guestEmail ? '✅' : '❌'}`);
      console.log(`    Guest Name: ${app.guestName} ${app.guestName ? '✅' : '❌'}`);
      console.log(`    Screening Consent: ${app.screeningConsent} ${app.screeningConsent ? '✅' : '❌'}`);
      console.log(`    Answers: ${app.answers ? '✅ stored' : '❌ missing'}`);
    }
  }

  const updatedIC = await ImportedCandidate.findByPk(importedCandidate.id);
  console.log('\n  ImportedCandidate:');
  console.log(`    Enrichment Status: ${updatedIC.enrichmentStatus} ${updatedIC.enrichmentStatus === 'completed' ? '✅' : '⚠️'}`);
  console.log(`    Has Screening Answers: ${!!updatedIC.enrichedData?.screeningAnswers ? '✅' : '❌'}`);
  console.log('');

  // ────────────────────────────────────────
  // 8. PRINT BROWSER TEST URLs
  // ────────────────────────────────────────
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  console.log('═══════════════════════════════════════');
  console.log('  BROWSER TEST URLs');
  console.log('═══════════════════════════════════════\n');
  console.log(`  📧 Quick Submit (Guest):  ${frontendUrl}/screen/${token}`);
  console.log(`  👤 Full Signup:           ${frontendUrl}/invite/${token}`);
  if (trackingCode) {
    console.log(`  🔍 Track Application:     ${frontendUrl}/track`);
    console.log(`     (enter code: ${trackingCode})`);
  }
  console.log('');

  // ────────────────────────────────────────
  // 9. SUMMARY
  // ────────────────────────────────────────
  const allPassed = 
    getRes.status === 200 && 
    postRes.status === 200 && 
    dupRes.status === 400 &&
    updatedInvitation.status === 'submitted' &&
    updatedInvitation.submissionType === 'guest_screening';

  console.log('═══════════════════════════════════════');
  if (allPassed) {
    console.log('  ✅ ALL TESTS PASSED');
  } else {
    console.log('  ⚠️  SOME TESTS FAILED (check above)');
  }
  console.log('═══════════════════════════════════════\n');

  // Ask about cleanup
  console.log('  Note: Test data was LEFT in the database so you can');
  console.log('  test the browser URLs above. To clean up later, run:');
  console.log(`  DELETE FROM "JobApplications" WHERE "trackingCode" = '${trackingCode}';`);
  console.log(`  DELETE FROM "CandidateInvitations" WHERE "id" = '${invitation.id}';`);
  console.log(`  DELETE FROM "ImportedCandidates" WHERE "id" = '${importedCandidate.id}';`);
  console.log('');

  process.exit(0);
}

run().catch(e => {
  console.error('\n✗ E2E Test failed:', e);
  process.exit(1);
});
