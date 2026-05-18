/**
 * Trigger Agent Arena screening for a job
 * This will create AgentNegotiation records visible in the Agent Arena UI
 */
const { Job, JobScreening, Profile, User, AgentNegotiation } = require('../models');
const { Op } = require('sequelize');
const recruitmentService = require('../services/recruitmentService');

async function triggerAgentArenaScreening(jobId) {
  // Find the job
  const job = await Job.findByPk(jobId);
  if (!job) {
    console.log('Job not found:', jobId);
    process.exit(1);
  }
  
  console.log('=== TRIGGERING AGENT ARENA SCREENING ===');
  console.log('Job:', job.title);
  console.log('Job ID:', job.id);
  
  // Create a new screening with Agent Arena enabled
  const config = {
    minMatchScore: 60,
    candidatesToScreen: 10, // Top 10%
    includePassiveCandidates: true,
    enablePhoneScreening: false,
    useAgentArena: true, // THIS IS THE KEY!
    screeningStyle: 'balanced',
    priorityFactors: ['skills', 'experience']
  };
  
  console.log('\nConfig:', JSON.stringify(config, null, 2));
  
  try {
    // Run the recruitment drive with Agent Arena
    const result = await recruitmentService.startRecruitmentDrive(job.id, config);
    
    console.log('\n=== RESULT ===');
    console.log('Candidates shortlisted:', result?.length || 0);
    
    // Check if negotiations were created
    const negotiations = await AgentNegotiation.count({ where: { jobId: job.id } });
    console.log('Agent Negotiations created:', negotiations);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

// Run for the Senior Frontend Developer job
triggerAgentArenaScreening('5fd98f7f-f518-4f50-9a01-46b94f909faf');
