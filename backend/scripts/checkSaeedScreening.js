const { Profile, User, JobScreening, Job } = require('../models');
const { Op } = require('sequelize');

async function check() {
  // Find Saeed's profile
  const saeed = await Profile.findOne({
    include: [{ model: User, as: 'user', where: { email: { [Op.iLike]: '%saeed%' } } }]
  });
  
  if (saeed) {
    console.log('=== SAEED PROFILE ===');
    console.log('Title:', saeed.title);
    console.log('Available:', saeed.availabilityStatus);
    console.log('isPublic:', saeed.isPublic);
    console.log('UserId:', saeed.userId);
  } else {
    console.log('Saeed profile not found!');
  }
  
  // Find frontend job
  const job = await Job.findOne({
    where: { title: { [Op.iLike]: '%frontend%' } },
    order: [['createdAt', 'DESC']]
  });
  
  if (!job) {
    console.log('No frontend job found');
    process.exit(1);
  }
  
  console.log('\n=== JOB ===');
  console.log('Job ID:', job.id);
  console.log('Title:', job.title);
  console.log('Skills:', JSON.stringify(job.skills));
  
  // Check job screening results
  const screening = await JobScreening.findOne({
    where: { jobId: job.id },
    order: [['createdAt', 'DESC']]
  });
  
  if (screening) {
    console.log('\n=== SCREENING ===');
    console.log('Status:', screening.status);
    console.log('Phase:', screening.currentPhase);
    
    // Check smart search results
    const searchResults = screening.smartSearchResults || [];
    console.log('\n=== SMART SEARCH RESULTS ===');
    console.log('Total candidates found:', searchResults.length);
    
    // Check if Saeed is in smart search
    const saeedInSearch = searchResults.find(r => 
      r.fullName?.toLowerCase().includes('saeed') || 
      r.email?.toLowerCase().includes('saeed') ||
      r.userId === saeed?.userId
    );
    
    if (saeedInSearch) {
      console.log('\nSaeed IN smart search:');
      console.log('  Score:', saeedInSearch.matchScore);
      console.log('  Title:', saeedInSearch.title);
    } else {
      console.log('\nSaeed NOT in smart search results!');
      console.log('\nTop 10 from smart search:');
      searchResults.slice(0, 10).forEach((r, i) => {
        console.log(`${i+1}. ${r.fullName || r.email} - Score: ${r.matchScore} - Title: ${r.title}`);
      });
    }
    
    // Check screening results (shortlist)
    const results = screening.screeningResults || [];
    console.log('\n=== SHORTLIST (screeningResults) ===');
    console.log('Total shortlisted:', results.length);
    
    results.forEach((r, i) => {
      console.log(`${i+1}. ${r.candidateName} - ${r.matchScore}% - Interest: ${r.interestLevel}%`);
    });
  } else {
    console.log('No screening found for this job');
  }
  
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
