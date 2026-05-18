const { Profile, User, Job } = require('../models');
const { Op } = require('sequelize');
const recruitmentService = require('../services/recruitmentService');

async function testSaeedScore() {
  // Find Saeed
  const saeed = await Profile.findOne({
    include: [{ model: User, as: 'user', where: { email: { [Op.iLike]: '%saeed%' } } }]
  });
  
  // Find the frontend job
  const job = await Job.findOne({
    where: { title: { [Op.iLike]: '%frontend%' } },
    order: [['createdAt', 'DESC']]
  });
  
  if (!saeed || !job) {
    console.log('Could not find Saeed or job');
    process.exit(1);
  }
  
  console.log('=== TESTING SAEED SCORE FOR FRONTEND JOB ===');
  console.log('Job:', job.title);
  console.log('Job Skills:', JSON.stringify(job.skills));
  console.log('\nSaeed Profile:');
  console.log('Title:', saeed.title);
  console.log('Headline:', saeed.headline);
  console.log('Skills:', JSON.stringify(saeed.skills, null, 2));
  console.log('Available:', saeed.availabilityStatus);
  console.log('isPublic:', saeed.isPublic);
  console.log('userId:', saeed.userId);
  console.log('Job userId:', job.userId);
  console.log('Are same user?', saeed.userId === job.userId);
  
  // Calculate the score
  const scoreResult = await recruitmentService.calculateModernScoreAsync(saeed, job, {
    jobSkills: job.skills || [],
    jobKeywords: recruitmentService.extractKeywordsFromJob(job),
    experienceLevel: job.experienceLevel || 'mid',
    location: job.location,
    locationType: job.locationType || 'onsite',
    priorityFactors: ['skills', 'experience', 'availability']
  });
  
  console.log('\n=== SCORE RESULT ===');
  console.log('Total Score:', scoreResult.totalScore);
  console.log('Breakdown:', JSON.stringify(scoreResult.breakdown, null, 2));
  console.log('Match Details:', scoreResult.matchDetails);
  
  process.exit(0);
}

testSaeedScore().catch(err => {
  console.error(err);
  process.exit(1);
});
