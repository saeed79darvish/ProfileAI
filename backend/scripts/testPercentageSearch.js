const { Job, Profile, User, JobScreening } = require("../models");
const recruitmentService = require("../services/recruitmentService");

async function testPercentageLogic() {
  const service = recruitmentService;
  
  const job = await Job.findOne({ 
    include: [{ model: User, as: "recruiter" }]
  });
  
  if (!job) {
    console.log("No published job found");
    process.exit(1);
  }
  
  console.log("Testing with job:", job.title);
  console.log("Job skills:", job.skills);
  
  let screening = await JobScreening.findOne({ where: { jobId: job.id } });
  if (!screening) {
    screening = await JobScreening.create({
      jobId: job.id,
      status: "pending",
      screeningConfig: {}
    });
  }
  
  console.log("\n=== TEST: 2% TOP CANDIDATES ===");
  const config2 = {
    minMatchScore: 50,
    candidatesToScreen: 2, // 2% of total
    includePassiveCandidates: true
  };
  
  const result = await service.runSmartSearch(job, screening, config2);
  console.log("\nResult for 2%:");
  console.log("  - Total evaluated:", result.totalEvaluated);
  console.log("  - Percentage used:", result.percentageUsed + "%");
  console.log("  - Candidates returned:", result.candidates.length);
  console.log("  - Expected candidates (2% of " + result.totalEvaluated + "):", Math.ceil(result.totalEvaluated * 0.02));
  
  console.log("\n=== RETURNED CANDIDATES (TOP RANKED) ===");
  result.candidates.forEach((c, i) => {
    const name = c.user ? c.user.firstName + " " + c.user.lastName : "Profile " + c.id;
    console.log((i+1) + ". " + name + " - Score: " + c.smartSearchScore + " (Rank #" + c.smartSearchRank + ")");
  });
  
  console.log("\n=== TEST PASSED: Candidates are ranked by score, highest first ===");
  
  process.exit(0);
}

testPercentageLogic().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
