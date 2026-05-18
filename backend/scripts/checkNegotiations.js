const { AgentNegotiation, Job, Profile, User } = require('../models');

async function checkNegotiations() {
  const negotiations = await AgentNegotiation.findAll({
    order: [['createdAt', 'DESC']],
    limit: 10,
    include: [
      { model: Job, as: 'job', attributes: ['title'] }
    ]
  });
  
  console.log('=== RECENT AGENT NEGOTIATIONS ===');
  console.log('Total found:', negotiations.length);
  
  negotiations.forEach(n => {
    console.log('\n---');
    console.log('ID:', n.id);
    console.log('Job:', n.job?.title || 'N/A');
    console.log('Candidate ID:', n.candidateId);
    console.log('Status:', n.status);
    console.log('Created:', n.createdAt);
  });
  
  // Check if any are for the frontend job
  const frontendJob = await Job.findOne({ where: { title: { [require('sequelize').Op.iLike]: '%frontend%' } } });
  if (frontendJob) {
    const frontendNegotiations = await AgentNegotiation.count({ where: { jobId: frontendJob.id } });
    console.log('\n=== FRONTEND JOB NEGOTIATIONS ===');
    console.log('Job ID:', frontendJob.id);
    console.log('Job Title:', frontendJob.title);
    console.log('Negotiations count:', frontendNegotiations);
  }
  
  process.exit(0);
}

checkNegotiations().catch(err => {
  console.error(err);
  process.exit(1);
});
