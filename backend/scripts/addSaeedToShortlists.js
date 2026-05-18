const sequelize = require('../config/database');
const { JobScreening, User, Profile } = require('../models');

(async () => {
  try {
    // Find Saeed Darvish
    const saeed = await User.findOne({ 
      where: { firstName: 'Saeed' },
      include: [{ model: Profile, as: 'profile' }]
    });
    
    if (!saeed) {
      console.log('Saeed not found!');
      process.exit(1);
    }
    
    console.log('Found Saeed:', saeed.id, saeed.firstName, saeed.lastName);
    
    // Get all screenings
    const screenings = await JobScreening.findAll();
    console.log('Found', screenings.length, 'screenings');
    
    for (const screening of screenings) {
      let shortlisted = JSON.parse(JSON.stringify(screening.shortlisted || []));
      
      // Check if Saeed already exists
      const exists = shortlisted.find(c => c.candidateId === saeed.id);
      
      if (!exists) {
        // Add Saeed at the TOP of the list with high score
        shortlisted.unshift({
          candidateId: saeed.id,
          name: saeed.firstName + ' ' + saeed.lastName,
          fitScore: 98,
          interestScore: 95,
          profilePicture: saeed.profile?.profilePicture || null,
          headline: saeed.profile?.headline || 'Full Stack Developer'
        });
        
        // Use changed() to force Sequelize to detect the change
        screening.shortlisted = shortlisted;
        screening.changed('shortlisted', true);
        await screening.save();
        console.log('✅ Added Saeed to job:', screening.jobId);
      } else {
        console.log('⏭️  Already in:', screening.jobId);
      }
    }
    
    console.log('\n🎉 Done! Saeed is now in all shortlists.');
    console.log('\nNext steps:');
    console.log('1. Go to Recruiter Jobs page');
    console.log('2. Click "View Candidates" on any job');
    console.log('3. You should see Saeed Darvish at the top');
    console.log('4. Click "Schedule Interview" for Saeed');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
})();
