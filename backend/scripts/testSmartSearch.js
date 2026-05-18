const axios = require('axios');

const BASE = 'http://localhost:5001/api';

(async () => {
  // Login as recruiter (admin role)
  const loginRes = await axios.post(`${BASE}/auth/login`, {
    email: 's79darvish@gmail.com',
    password: 'Saeed@1234'
  });
  const token = loginRes.data.token;
  console.log('Got token');
  
  const headers = { Authorization: `Bearer ${token}` };

  // Get the latest frontend job
  const { Job } = require('../models');
  const job = await Job.findOne({
    where: { title: 'Senior Frontend developer' },
    order: [['createdAt', 'DESC']]
  });
  console.log('Job ID:', job.id, '| Title:', job.title, '| Skills:', JSON.stringify(job.skills));

  // Start a new screening (search-only mode)
  console.log('\nStarting screening...');
  const screeningRes = await axios.post(`${BASE}/recruitment/jobs/${job.id}/screen`, {
    searchOnly: true,
    screeningConfig: {
      minMatchScore: 30,
      candidatesToScreen: 25,  // 25% of candidates
      includePassiveCandidates: true,
      priorityFactors: ['skills', 'experience']
    }
  }, { headers });
  
  const screeningId = screeningRes.data.screeningId;
  console.log('Screening ID:', screeningId);

  // Poll until search_complete
  let status = '';
  let result;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await axios.get(`${BASE}/recruitment/screenings/${screeningId}/status`, { headers });
    result = statusRes.data;
    status = result.status;
    console.log(`Poll ${i+1}: status=${status}, step=${result.currentStep?.substring(0, 80)}`);
    if (status === 'search_complete' || status === 'completed' || status === 'error') break;
  }

  if (result.searchResults) {
    console.log('\n=== SEARCH RESULTS ===');
    console.log('Total candidates:', result.searchResults.length);
    result.searchResults.forEach((r, i) => {
      console.log(`${i+1}. ${r.name} | Score:${r.score} | Title: ${r.title} | Skills: ${JSON.stringify(r.skills?.slice(0, 5))}`);
    });
    
    // Check for Saeed
    const saeed = result.searchResults.find(r => r.name?.includes('Saeed'));
    if (saeed) {
      console.log('\n✅ Saeed Darvish found! Score:', saeed.score, '| Rank:', result.searchResults.indexOf(saeed) + 1);
    } else {
      console.log('\n❌ Saeed Darvish NOT in results');
    }
  }
  
  process.exit(0);
})().catch(err => { console.error('Error:', err.response?.data || err.message); process.exit(1); });
