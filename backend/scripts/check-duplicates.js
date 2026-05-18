const { Interview, Job } = require('../models');

async function checkDuplicates() {
  const interviews = await Interview.findAll({
    where: { status: 'confirmed', candidateId: '10615ad6-717a-4074-a7c7-a59089b34b3d' },
    include: [{ model: Job, as: 'job', attributes: ['id', 'title'] }],
    order: [['scheduledAt', 'DESC']]
  });
  
  console.log('Confirmed interviews for this candidate:', interviews.length);
  
  // Check for duplicates by jobId
  const byJob = {};
  interviews.forEach(i => {
    const jobId = i.jobId;
    if (!byJob[jobId]) byJob[jobId] = [];
    byJob[jobId].push(i);
  });
  
  Object.entries(byJob).forEach(([jobId, list]) => {
    console.log('\nJob:', list[0].job?.title, '- Count:', list.length);
    list.forEach(i => console.log('  ', i.id.substring(0,8), i.scheduledAt?.toISOString()));
  });
  
  process.exit(0);
}

checkDuplicates();
