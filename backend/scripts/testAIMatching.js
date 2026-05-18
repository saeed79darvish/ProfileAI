/**
 * Test script for AI-Powered Skills Matching Service
 * 
 * Run: cd backend && node scripts/testAIMatching.js
 */

require('dotenv').config();
const { aiSkillsMatching } = require('../services/aiSkillsMatchingService');

async function runTests() {
  console.log('🧪 Testing AI-Powered Skills Matching Service\n');
  console.log('=' .repeat(60));

  // Test 1: Tech skills (variations)
  console.log('\n📌 TEST 1: Tech Skills (Variations)');
  console.log('-'.repeat(40));
  const techJob = ['React', 'Node.js', 'TypeScript', 'PostgreSQL'];
  const techCandidate = ['ReactJS', 'NodeJS', 'TS', 'Postgres', 'Docker'];
  
  const techResult = await aiSkillsMatching.calculateSkillMatch(techJob, techCandidate);
  console.log('Job requires:', techJob.join(', '));
  console.log('Candidate has:', techCandidate.join(', '));
  console.log('Score:', techResult.score, '/ 100');
  console.log('Summary:', techResult.summary);
  console.log('Details:');
  techResult.details?.forEach(d => {
    console.log(`  ${d.jobSkill} → ${d.match || 'NO MATCH'} (${d.similarity} similarity, ${d.matchType})`);
  });

  // Test 2: Healthcare skills
  console.log('\n📌 TEST 2: Healthcare Skills');
  console.log('-'.repeat(40));
  const healthJob = ['Patient Care', 'EMR Systems', 'HIPAA Compliance', 'Nursing'];
  const healthCandidate = ['Patient Management', 'Electronic Medical Records', 'Healthcare Compliance', 'Registered Nurse', 'Bedside Care'];
  
  const healthResult = await aiSkillsMatching.calculateSkillMatch(healthJob, healthCandidate);
  console.log('Job requires:', healthJob.join(', '));
  console.log('Candidate has:', healthCandidate.join(', '));
  console.log('Score:', healthResult.score, '/ 100');
  console.log('Summary:', healthResult.summary);
  console.log('Details:');
  healthResult.details?.forEach(d => {
    console.log(`  ${d.jobSkill} → ${d.match || 'NO MATCH'} (${d.similarity} similarity, ${d.matchType})`);
  });

  // Test 3: Marketing skills
  console.log('\n📌 TEST 3: Marketing Skills');
  console.log('-'.repeat(40));
  const marketingJob = ['SEO', 'Google Ads', 'Content Marketing', 'Social Media Management'];
  const marketingCandidate = ['Search Engine Optimization', 'PPC Advertising', 'Blog Writing', 'Instagram Marketing', 'HubSpot'];
  
  const marketingResult = await aiSkillsMatching.calculateSkillMatch(marketingJob, marketingCandidate);
  console.log('Job requires:', marketingJob.join(', '));
  console.log('Candidate has:', marketingCandidate.join(', '));
  console.log('Score:', marketingResult.score, '/ 100');
  console.log('Summary:', marketingResult.summary);
  console.log('Details:');
  marketingResult.details?.forEach(d => {
    console.log(`  ${d.jobSkill} → ${d.match || 'NO MATCH'} (${d.similarity} similarity, ${d.matchType})`);
  });

  // Test 4: Finance skills
  console.log('\n📌 TEST 4: Finance Skills');
  console.log('-'.repeat(40));
  const financeJob = ['Financial Modeling', 'Excel', 'Accounting', 'Budgeting'];
  const financeCandidate = ['Financial Analysis', 'Microsoft Excel', 'CPA', 'Budget Planning', 'QuickBooks'];
  
  const financeResult = await aiSkillsMatching.calculateSkillMatch(financeJob, financeCandidate);
  console.log('Job requires:', financeJob.join(', '));
  console.log('Candidate has:', financeCandidate.join(', '));
  console.log('Score:', financeResult.score, '/ 100');
  console.log('Summary:', financeResult.summary);
  console.log('Details:');
  financeResult.details?.forEach(d => {
    console.log(`  ${d.jobSkill} → ${d.match || 'NO MATCH'} (${d.similarity} similarity, ${d.matchType})`);
  });

  // Test 5: Two skill comparison
  console.log('\n📌 TEST 5: Direct Skill Comparison');
  console.log('-'.repeat(40));
  const pairs = [
    ['JavaScript', 'JS'],
    ['React', 'Vue'],
    ['Python', 'Machine Learning'],
    ['Nursing', 'Software Engineering'],
    ['SEO', 'Search Engine Optimization']
  ];
  
  for (const [skill1, skill2] of pairs) {
    const similarity = await aiSkillsMatching.compareTwoSkills(skill1, skill2);
    console.log(`  "${skill1}" ↔ "${skill2}": ${(similarity * 100).toFixed(1)}% similar`);
  }

  // Cache stats
  console.log('\n📊 Cache Statistics:');
  console.log(aiSkillsMatching.getCacheStats());

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!');
}

runTests().catch(console.error);
