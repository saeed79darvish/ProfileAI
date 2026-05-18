const { Job, RecruiterProfile } = require('../models');

async function fix() {
  // Find jobs for chaloos recrut
  const job = await Job.findOne({ where: { company: 'chaloos recrut' } });
  if (!job) { 
    console.log('No job found'); 
    process.exit(1); 
  }
  
  console.log('Job found, userId:', job.userId);
  
  // Check if recruiter profile exists
  let profile = await RecruiterProfile.findOne({ where: { userId: job.userId } });
  
  if (!profile) {
    // Create recruiter profile
    profile = await RecruiterProfile.create({
      userId: job.userId,
      companyName: 'chaloos recrut',
      companySlug: 'chaloos-recrut',
      jobTitle: 'Recruiter',
      industry: 'Technology',
      companyDescription: 'A modern recruiting company',
      location: 'Remote'
    });
    console.log('Created new RecruiterProfile with slug:', profile.companySlug);
  } else {
    // Update existing profile
    await profile.update({
      companyName: 'chaloos recrut',
      companySlug: 'chaloos-recrut'
    });
    console.log('Updated RecruiterProfile with slug:', profile.companySlug);
  }
  
  console.log('Done! Visit: http://localhost:3000/company/chaloos-recrut');
  process.exit(0);
}

fix();
