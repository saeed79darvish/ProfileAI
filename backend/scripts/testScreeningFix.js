/**
 * Test script for the screening fix
 * Run: cd backend && node scripts/testScreeningFix.js
 */

require('dotenv').config();
const { Job, Profile, User, JobScreening } = require('../models');
const recruitmentService = require('../services/recruitmentService');
const { Op } = require('sequelize');

async function testScreening() {
  // Find a frontend job
  const job = await Job.findOne({ 
    where: { title: { [Op.iLike]: '%frontend%' } },
    order: [['createdAt', 'DESC']]
  });
  
  if (!job) {
    console.log('No frontend job found');
    process.exit(1);
  }
  
  console.log('=== TESTING SCREENING FIX ===');
  console.log('Job:', job.title);
  console.log('Skills:', job.skills?.join(', ') || 'None');
  
  // Get or create screening record
  let screening = await JobScreening.findOne({ where: { jobId: job.id } });
  if (!screening) {
    screening = await JobScreening.create({ jobId: job.id, status: 'pending' });
  }
  
  // Run smart search for 2 candidates
  console.log('\n--- Testing with candidatesToScreen: 2 ---');
  const result = await recruitmentService.runSmartSearch(job, screening, {
    candidatesToScreen: 2,
    minMatchScore: 50
  });
  
  console.log('\n=== RESULTS ===');
  console.log('Candidates selected:', result.candidates.length);
  result.scoredResults.forEach((s, i) => {
    const name = s.profile.user ? `${s.profile.user.firstName} ${s.profile.user.lastName}` : 'Unknown';
    console.log(`${i+1}. ${name}: ${s.totalScore}/100`);
  });
  
  process.exit(0);
}

testScreening().catch(e => { console.error(e); process.exit(1); });
