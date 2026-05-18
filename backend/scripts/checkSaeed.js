const { Profile, User, Job, JobScreening } = require('../models');

async function checkSaeed() {
  console.log("=== LOOKING FOR SAEED ===");
  
  const profiles = await Profile.findAll({
    include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'email', 'role'] }],
    attributes: ['id', 'userId', 'title', 'headline', 'skills', 'isPublic', 'availabilityStatus']
  });
  
  const saeed = profiles.find(p => p.user && p.user.firstName && p.user.firstName.toLowerCase().includes('saeed'));
  if (saeed) {
    console.log("Found Saeed:");
    console.log("  Name:", saeed.user.firstName, saeed.user.lastName);
    console.log("  Email:", saeed.user.email);
    console.log("  Role:", saeed.user.role);
    console.log("  Title:", saeed.title);
    console.log("  Headline:", saeed.headline);
    console.log("  Skills:", Object.keys(saeed.skills || {}).join(', '));
    console.log("  isPublic:", saeed.isPublic);
    console.log("  availabilityStatus:", saeed.availabilityStatus);
  } else {
    console.log("Saeed not found in profiles");
  }

  console.log("\n=== FRONTEND-RELATED PROFILES ===");
  const frontendProfiles = profiles.filter(p => {
    const skillsStr = JSON.stringify(p.skills || {}).toLowerCase();
    const title = (p.title || '').toLowerCase();
    const headline = (p.headline || '').toLowerCase();
    return (skillsStr.includes('react') || skillsStr.includes('frontend') || 
            skillsStr.includes('javascript') || skillsStr.includes('vue') ||
            title.includes('frontend') || headline.includes('frontend'));
  });
  
  console.log(`Found ${frontendProfiles.length} profiles with frontend skills`);
  frontendProfiles.slice(0, 10).forEach(p => {
    const name = p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Unknown';
    const skillsList = Object.keys(p.skills || {}).slice(0, 5).join(', ');
    console.log(`  - ${name} | Title: ${p.title} | Skills: ${skillsList} | Public: ${p.isPublic} | Status: ${p.availabilityStatus}`);
  });
  
  console.log("\n=== RECENT JOB SCREENINGS (LAST 5) ===");
  const screenings = await JobScreening.findAll({
    include: [{ model: Job, as: 'job', attributes: ['title', 'company', 'skills'] }],
    order: [['createdAt', 'DESC']],
    limit: 5
  });
  
  screenings.forEach(s => {
    console.log(`Job: ${s.job?.title || 'Unknown'}`);
    console.log(`  Status: ${s.status}, Phase: ${s.currentPhase}`);
    console.log(`  Evaluated: ${s.totalCandidatesEvaluated}, Found: ${s.candidatesFound}, Screened: ${s.candidatesScreened}`);
    console.log(`  Config: ${JSON.stringify(s.screeningConfig)}`);
    console.log(`  Shortlisted: ${JSON.stringify(s.shortlisted)}`);
    console.log();
  });
  
  process.exit(0);
}

checkSaeed().catch(e => { console.error(e); process.exit(1); });
