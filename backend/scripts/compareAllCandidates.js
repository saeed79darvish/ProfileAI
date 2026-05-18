const { Profile, User, Job } = require('../models');
const { Op } = require('sequelize');
const recruitmentService = require('../services/recruitmentService');

async function compareAllCandidates() {
  // Find the frontend job
  const job = await Job.findOne({
    where: { title: { [Op.iLike]: '%frontend%' } },
    order: [['createdAt', 'DESC']]
  });
  
  // Get all candidate profiles (excluding the job poster)
  const candidates = await Profile.findAll({
    where: {
      userId: { [Op.ne]: job.userId },
      isPublic: true
    },
    include: [{ 
      model: User, 
      as: 'user', 
      where: { role: 'candidate' },
      attributes: ['id', 'firstName', 'lastName', 'email']
    }]
  });
  
  console.log(`=== COMPARING ALL ${candidates.length} CANDIDATES FOR: ${job.title} ===`);
  console.log(`Job Skills: ${JSON.stringify(job.skills)}`);
  
  // Score all candidates
  const jobKeywords = recruitmentService.extractKeywordsFromJob(job);
  const results = [];
  
  for (const profile of candidates) {
    const scoreResult = await recruitmentService.calculateModernScoreAsync(profile, job, {
      jobSkills: job.skills || [],
      jobKeywords,
      experienceLevel: job.experienceLevel || 'mid',
      location: job.location,
      locationType: job.locationType || 'onsite',
      priorityFactors: ['skills', 'experience', 'availability']
    });
    
    results.push({
      name: `${profile.user?.firstName || ''} ${profile.user?.lastName || ''}`.trim() || profile.user?.email,
      title: profile.title || profile.headline,
      score: scoreResult.totalScore,
      breakdown: scoreResult.breakdown
    });
  }
  
  // Sort by score
  results.sort((a, b) => b.score - a.score);
  
  console.log('\n=== TOP 15 CANDIDATES BY SCORE ===');
  results.slice(0, 15).forEach((r, i) => {
    console.log(`\n${i+1}. ${r.name} - Score: ${r.score}`);
    console.log(`   Title: ${r.title}`);
    console.log(`   Skills: ${r.breakdown.skills}, TitleMatch: ${r.breakdown.titleMatch}, Exp: ${r.breakdown.experience}, Loc: ${r.breakdown.location}, Avail: ${r.breakdown.availability}`);
  });
  
  // Find where Saeed ranks
  const saeedIdx = results.findIndex(r => r.name?.toLowerCase().includes('saeed') || r.title?.toLowerCase().includes('full-stack'));
  if (saeedIdx >= 0) {
    console.log(`\n=== SAEED RANKS #${saeedIdx + 1} ===`);
  }
  
  process.exit(0);
}

compareAllCandidates().catch(err => {
  console.error(err);
  process.exit(1);
});
