const recruitmentService = require('../services/recruitmentService');
const { Job, JobScreening } = require('../models');

(async () => {
  // Get the latest frontend job
  const job = await Job.findOne({
    where: { title: 'Senior Frontend developer' },
    order: [['createdAt', 'DESC']]
  });
  console.log('Job ID:', job.id, '| Title:', job.title, '| Skills:', JSON.stringify(job.skills));

  // Use existing screening or create a mock that just tracks updates
  const screening = await JobScreening.findOne({ where: { jobId: job.id }, order: [['createdAt', 'DESC']] });
  if (!screening) {
    console.error('No screening found for this job');
    process.exit(1);
  }
  console.log('Using existing screening:', screening.id);

  // Reset status so we can re-run
  await screening.update({ status: 'searching', progressPercent: 0 });

  console.log('\nRunning smart search...');
  const result = await recruitmentService.runSmartSearch(job, screening, {
    minMatchScore: 30,
    candidatesToScreen: 25,
    includePassiveCandidates: true,
    priorityFactors: ['skills', 'experience']
  });

  console.log('\n=== RESULTS ===');
  console.log('Total evaluated:', result.totalEvaluated);
  console.log('Top selected:', result.candidates.length);
  console.log('Percentage used:', result.percentageUsed);
  
  result.candidates.forEach((p, i) => {
    const name = p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Unknown';
    const title = p.title || p.headline || '(no title)';
    console.log(`${i+1}. ${name} | Score:${p.smartSearchScore} | Title: ${title} | Breakdown: ${JSON.stringify(p.smartSearchBreakdown)}`);
  });
  
  // Check for Saeed
  const saeed = result.candidates.find(p => 
    p.user && p.user.firstName === 'Saeed'
  );
  if (saeed) {
    console.log('\n✅ Saeed Darvish FOUND! Score:', saeed.smartSearchScore);
    console.log('   Breakdown:', JSON.stringify(saeed.smartSearchBreakdown));
  } else {
    console.log('\n❌ Saeed Darvish NOT found in selected candidates');
    // Check in all scored results
    const saeedInAll = result.scoredResults?.find(s => 
      s.profile?.user?.firstName === 'Saeed'
    );
    if (saeedInAll) {
      console.log('   But found in all results - Score:', saeedInAll.totalScore, '| Breakdown:', JSON.stringify(saeedInAll.breakdown));
    }
  }

  // Cleanup test screening
  await screening.update({ status: 'search_complete' });
  process.exit(0);
})().catch(err => { console.error('Error:', err.message, err.stack); process.exit(1); });
