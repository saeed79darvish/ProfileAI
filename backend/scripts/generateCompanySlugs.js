const { RecruiterProfile, sequelize } = require('../models');
const { Op } = require('sequelize');

function generateSlug(companyName) {
  if (!companyName) return null;
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

async function run() {
  try {
    // First list all profiles
    const allProfiles = await RecruiterProfile.findAll({
      attributes: ['id', 'userId', 'companyName', 'companySlug']
    });
    
    console.log('\n=== EXISTING RECRUITER PROFILES ===');
    allProfiles.forEach(p => {
      console.log(`  ${p.companyName || '(no name)'} | slug: ${p.companySlug || '(none)'}`);
    });
    
    // Generate slugs for those without
    const profilesWithoutSlug = await RecruiterProfile.findAll({
      where: {
        companySlug: null,
        companyName: { [Op.ne]: null }
      }
    });
    
    console.log(`\n=== GENERATING SLUGS FOR ${profilesWithoutSlug.length} PROFILES ===`);
    
    for (const profile of profilesWithoutSlug) {
      const baseSlug = generateSlug(profile.companyName);
      if (!baseSlug) continue;
      
      let slug = baseSlug;
      let counter = 1;
      while (await RecruiterProfile.findOne({ where: { companySlug: slug } })) {
        slug = `${baseSlug}-${counter++}`;
      }
      
      await profile.update({ companySlug: slug });
      console.log(`  ✓ ${profile.companyName} → /company/${slug}`);
    }
    
    // Show final list
    const finalProfiles = await RecruiterProfile.findAll({
      attributes: ['companyName', 'companySlug'],
      where: { companySlug: { [Op.ne]: null } }
    });
    
    console.log('\n=== COMPANY PAGES AVAILABLE ===');
    finalProfiles.forEach(p => {
      console.log(`  http://localhost:3000/company/${p.companySlug}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

run();
