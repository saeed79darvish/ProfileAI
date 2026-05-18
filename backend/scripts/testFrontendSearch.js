const { Profile, User, Job, JobScreening } = require('../models');
const recruitmentService = require('../services/recruitmentService');

async function testSmartSearchForFrontend() {
  console.log("=== TESTING SMART SEARCH FOR FRONTEND JOB ===\n");
  
  // Get the most recent frontend job
  const job = await Job.findOne({
    where: { title: { [require('sequelize').Op.iLike]: '%frontend%' } },
    order: [['createdAt', 'DESC']]
  });
  
  if (!job) {
    console.log("No frontend job found");
    process.exit(1);
  }
  
  console.log("Job:", job.title);
  console.log("  Skills in job:", JSON.stringify(job.skills));
  
  // Test title matching directly
  console.log("\n=== TESTING TITLE MATCHING LOGIC ===");
  const testTitles = [
    'Principal Full-Stack Software Engineer & Architect',
    'Senior Full Stack Engineer',
    'DevOps Engineer',
    'Backend Engineer',
    'UI/UX Designer',
    'Data Scientist'
  ];
  
  const jobTitle = job.title.toLowerCase();
  const jobRoles = recruitmentService.extractRoleComponents(jobTitle);
  console.log("Job title:", job.title);
  console.log("Job components:", JSON.stringify(jobRoles, null, 2));
  
  testTitles.forEach(title => {
    const candRoles = recruitmentService.extractRoleComponents(title.toLowerCase());
    console.log("\n  Candidate:", title);
    console.log("  Components:", JSON.stringify(candRoles));
    
    // Check primary matches
    const primaryMatches = jobRoles.primary.filter(jp => 
      candRoles.primary.some(cp => 
        cp === jp || cp.includes(jp) || jp.includes(cp) ||
        recruitmentService.areRelatedRoles(jp, cp)
      )
    );
    console.log("  Primary matches:", primaryMatches);
  });
  
  // Get existing screening record
  let screening = await JobScreening.findOne({ where: { jobId: job.id } });
  if (!screening) {
    console.log("No screening record found");
    process.exit(1);
  }
  
  console.log("\n=== Running Smart Search ===\n");
  
  try {
    const result = await recruitmentService.runSmartSearch(job, screening, {
      minMatchScore: 40,
      candidatesToScreen: 10, // 10%
      includePassiveCandidates: true
    });
    
    console.log("\n=== SMART SEARCH RESULTS ===");
    console.log("Total evaluated:", result.totalEvaluated);
    console.log("Top selected:", result.candidates.length);
    
    console.log("\n=== TOP CANDIDATES WITH SCORES ===");
    result.candidates.forEach((profile, i) => {
      const name = profile.user ? `${profile.user.firstName} ${profile.user.lastName}` : 'Unknown';
      console.log(`${i + 1}. ${name}`);
      console.log(`   Title: ${profile.title || profile.headline}`);
      console.log(`   Score: ${profile.smartSearchScore}/100`);
      console.log(`   Breakdown: ${JSON.stringify(profile.smartSearchBreakdown)}`);
    });
    
    // Check if Saeed is in the top candidates
    const saeed = result.candidates.find(p => 
      p.user && p.user.firstName && p.user.firstName.toLowerCase().includes('saeed')
    );
    
    if (saeed) {
      console.log("\n✅ Saeed IS in the top candidates!");
      console.log("   Score:", saeed.smartSearchScore);
    } else {
      console.log("\n❌ Saeed is NOT in the top candidates");
      
      // Check all scored results
      const saeedInAll = result.scoredResults.find(s => 
        s.profile.user && s.profile.user.firstName && 
        s.profile.user.firstName.toLowerCase().includes('saeed')
      );
      
      if (saeedInAll) {
        console.log("   Saeed's score in all results:", saeedInAll.totalScore);
        console.log("   Breakdown:", JSON.stringify(saeedInAll.breakdown));
      }
    }
    
  } catch (error) {
    console.error("Error:", error);
  }
  
  process.exit(0);
}

testSmartSearchForFrontend().catch(e => { console.error(e); process.exit(1); });
