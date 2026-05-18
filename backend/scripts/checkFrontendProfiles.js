const { Profile, User } = require('../models');

async function checkFrontendProfiles() {
  const profiles = await Profile.findAll({
    include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName'] }],
    attributes: ['title', 'headline', 'skills']
  });
  
  console.log('=== PROFILES WITH FRONTEND/FULLSTACK IN TITLE ===');
  profiles.forEach(p => {
    const t = (p.title || p.headline || '').toLowerCase();
    if (t.includes('frontend') || t.includes('front-end') || t.includes('full stack') || 
        t.includes('fullstack') || t.includes('full-stack')) {
      const name = p.user ? p.user.firstName + ' ' + p.user.lastName : 'Unknown';
      console.log(' -', name, '|', p.title || p.headline);
      console.log('   Skills:', Object.keys(p.skills || {}).join(', '));
    }
  });
  
  console.log('\n=== PROFILES THAT SHOULD MATCH FRONTEND (skills have frontend/react/vue) ===');
  profiles.forEach(p => {
    const t = (p.title || p.headline || '').toLowerCase();
    const skillsKeys = Object.keys(p.skills || {}).map(k => k.toLowerCase());
    const hasRelevantSkills = skillsKeys.some(k => 
      k.includes('react') || k.includes('frontend') || k.includes('vue') || 
      k.includes('angular') || k.includes('javascript') || k.includes('typescript')
    );
    const hasRelevantTitle = t.includes('ui') || t.includes('ux');
    
    if (hasRelevantSkills || hasRelevantTitle) {
      const name = p.user ? p.user.firstName + ' ' + p.user.lastName : 'Unknown';
      console.log(' -', name, '|', p.title || p.headline);
      console.log('   Skills:', Object.keys(p.skills || {}).slice(0, 6).join(', '));
    }
  });
  
  console.log('\n=== SAEED\'S PROFILE ===');
  const saeed = profiles.find(p => p.user && p.user.firstName && p.user.firstName.toLowerCase().includes('saeed'));
  if (saeed) {
    console.log('Name:', saeed.user.firstName, saeed.user.lastName);
    console.log('Title:', saeed.title);
    console.log('Headline:', saeed.headline);
    console.log('Skills:', JSON.stringify(saeed.skills, null, 2));
  } else {
    console.log('Saeed not found');
  }
  
  process.exit(0);
}

checkFrontendProfiles().catch(e => { console.error(e); process.exit(1); });
