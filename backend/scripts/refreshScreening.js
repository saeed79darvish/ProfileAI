/**
 * Force re-run smart search for a job and update stored results
 */
const recruitmentService = require('../services/recruitmentService');
const { Job, JobScreening, User, Profile } = require('../models');

(async () => {
  // Get the job
  const job = await Job.findOne({
    where: { title: 'Senior Frontend developer' },
    order: [['createdAt', 'DESC']],
    include: [{ model: User, as: 'recruiter' }]
  });
  console.log('Job:', job.title, '| ID:', job.id);
  console.log('Job skills:', JSON.stringify(job.skills));

  // Get existing screening
  const screening = await JobScreening.findOne({ where: { jobId: job.id } });
  if (!screening) {
    console.log('No screening found');
    process.exit(1);
  }
  
  const config = screening.screeningConfig || {};
  console.log('Screening config:', JSON.stringify(config));

  // Reset screening
  await screening.update({
    status: 'searching',
    progressPercent: 0,
    searchResults: [],
    candidatesFound: 0,
    totalCandidatesEvaluated: 0
  });

  // Run smart search with the screening config
  const { candidates, totalEvaluated, searchMetrics } = await recruitmentService.runSmartSearch(job, screening, config);
  
  console.log('\nSmart Search Complete: Evaluated', totalEvaluated, 'Found', candidates.length);
  
  // Format search results the same way startRecruitmentDrive does
  const searchResults = candidates.map(profile => {
    let skillsList = [];
    if (profile.skills) {
      if (Array.isArray(profile.skills)) {
        skillsList = profile.skills.map(s => typeof s === 'string' ? s : s.name || '').filter(Boolean);
      } else if (typeof profile.skills === 'object') {
        Object.values(profile.skills).forEach(cat => {
          if (Array.isArray(cat)) {
            cat.forEach(s => {
              const name = typeof s === 'string' ? s : s.name || '';
              if (name) skillsList.push(name);
            });
          }
        });
      }
    }

    return {
      candidateId: profile.userId,
      name: profile.user ? `${profile.user.firstName} ${profile.user.lastName}` : 'Unknown',
      email: profile.user?.email,
      title: profile.title || profile.headline,
      location: profile.location,
      score: profile.smartSearchScore || 0,
      breakdown: profile.smartSearchBreakdown || {},
      profilePicture: profile.profilePicture,
      skills: skillsList.slice(0, 10),
      experience: profile.experience?.length || 0
    };
  });

  // Update screening with new results
  await screening.update({ 
    searchCompletedAt: new Date(),
    candidatesFound: candidates.length,
    totalCandidatesEvaluated: totalEvaluated,
    searchResults: searchResults,
    status: 'search_complete',
    currentPhase: 'selection',
    currentStep: `Smart search complete. Found ${candidates.length} qualified candidates.`,
    progressPercent: 35
  });
  
  console.log('\n=== UPDATED SEARCH RESULTS (stored in DB) ===');
  searchResults.forEach((r, i) => {
    console.log(`${i+1}. ${r.name} | Score:${r.score} | Title:${r.title} | Skills(${r.skills.length}):${r.skills.slice(0,5).join(', ')} | Breakdown.skills:${r.breakdown?.skills}`);
  });
  
  const avgScore = Math.round(searchResults.reduce((a, b) => a + b.score, 0) / searchResults.length);
  console.log(`\nTotal: ${searchResults.length} | Avg Score: ${avgScore}`);
  
  // Check Saeed
  const saeed = searchResults.find(r => r.name?.includes('Saeed'));
  if (saeed) {
    console.log('\n✅ Saeed Darvish: rank', searchResults.indexOf(saeed)+1, '| Score:', saeed.score, '| Skills:', saeed.skills.slice(0,5).join(', '));
  } else {
    console.log('\n❌ Saeed Darvish not in results');
  }

  process.exit(0);
})().catch(err => { console.error('Error:', err.message); process.exit(1); });
