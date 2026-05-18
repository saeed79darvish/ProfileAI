const { User, Profile, Job, RecruiterProfile } = require('../models');
const recruitmentService = require('../services/recruitmentService');
const sequelize = require('../config/database');

const runTest = async () => {
  try {
    console.log('--- Starting Recruitment Test ---');

    // 1. Check for Candidates
    const candidateCount = await Profile.count();
    console.log(`Found ${candidateCount} candidate profiles.`);
    
    if (candidateCount === 0) {
      console.log('No candidates found! Please run "npm run add-mock-profiles" first.');
      return;
    }

    // 2. Get or Create Recruiter
    let recruiter = await User.findOne({ where: { role: 'recruiter' } });
    if (!recruiter) {
      console.log('Creating mock recruiter...');
      recruiter = await User.create({
        firstName: 'Test',
        lastName: 'Recruiter',
        email: `recruiter_${Date.now()}@test.com`,
        password: 'password123',
        role: 'recruiter'
      });
      await RecruiterProfile.create({
        userId: recruiter.id,
        companyName: 'Test Corp'
      });
    }
    console.log(`Using recruiter: ${recruiter.email}`);

    // 3. Create Job
    console.log('Creating test job...');
    const job = await Job.create({
      userId: recruiter.id,
      title: 'Senior React Developer',
      company: 'Test Corp',
      location: 'Remote',
      description: 'We are looking for an expert React developer with Node.js experience.',
      skills: ['React', 'Node.js', 'TypeScript'],
      status: 'active'
    });
    console.log(`Job created: ${job.id}`);

    // 4. Trigger Recruitment Drive
    console.log('Triggering recruitment drive...');
    const shortlisted = await recruitmentService.startRecruitmentDrive(job.id);
    
    console.log('--- Test Complete ---');
    console.log(`Shortlisted ${shortlisted.length} candidates.`);
    console.log(JSON.stringify(shortlisted, null, 2));

  } catch (error) {
    console.error('Test Failed:', error);
  } finally {
    await sequelize.close();
  }
};

runTest();
