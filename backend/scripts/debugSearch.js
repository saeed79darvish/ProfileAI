const { User, Profile } = require('../models');

(async () => {
  // Check Saeed Darvish
  const saeedUsers = await User.findAll({
    where: { firstName: 'Saeed' },
    include: [{ model: Profile, as: 'profile' }]
  });
  
  saeedUsers.forEach(u => {
    console.log('=== SAEED DARVISH ===');
    console.log('User:', u.firstName, u.lastName, '| Role:', u.role, '| ID:', u.id);
    console.log('Has profile:', !!u.profile);
    if (u.profile) {
      console.log('Profile title:', u.profile.title);
      console.log('Profile isPublic:', u.profile.isPublic);
      console.log('Availability:', u.profile.availabilityStatus);
      console.log('Skills:', JSON.stringify(u.profile.skills));
    }
  });

  // Check score distribution for the job with empty skills
  const { Job } = require('../models');
  const job = await Job.findOne({ where: { title: 'Senior Frontend developer' }, order: [['createdAt', 'DESC']] });
  console.log('\n=== JOB ===');
  console.log('Title:', job.title);
  console.log('Skills:', JSON.stringify(job.skills));
  console.log('Job userId (recruiter):', job.userId);

  // Check who gets excluded
  const { Op } = require('sequelize');
  const allCandidates = await Profile.findAll({
    where: {
      userId: { [Op.ne]: job.userId },
      isPublic: true,
    },
    include: [{ model: User, as: 'user', where: { role: 'candidate' }, attributes: ['id', 'firstName', 'lastName'] }],
    attributes: ['id', 'userId', 'title', 'availabilityStatus', 'skills']
  });
  console.log('\n=== ALL CANDIDATE PROFILES (excl recruiter) ===');
  console.log('Total:', allCandidates.length);
  
  // Check who has "frontend" in their title
  const frontendCandidates = allCandidates.filter(p => {
    const title = (p.title || '').toLowerCase();
    return title.includes('frontend') || title.includes('front-end') || title.includes('full stack') || title.includes('full-stack');
  });
  console.log('\nFrontend-related candidates:');
  frontendCandidates.forEach(p => {
    const skills = p.skills || {};
    const frontendSkills = skills.frontend || [];
    console.log(`  - ${p.user.firstName} ${p.user.lastName}: "${p.title}" | Availability: ${p.availabilityStatus} | Frontend skills: ${JSON.stringify(frontendSkills)}`);
  });

  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
