const { User, Profile } = require('../models');

async function checkProfiles() {
  try {
    const users = await User.findAll({
      include: [{
        model: Profile,
        as: 'profile'
      }]
    });

    console.log(`\n📊 Total users in database: ${users.length}\n`);

    if (users.length === 0) {
      console.log('❌ No users found in database!\n');
      process.exit(0);
    }

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`   Email: ${user.email}`);
      if (user.profile) {
        console.log(`   Profile: ${user.profile.title}`);
        console.log(`   Location: ${user.profile.location}`);
        console.log(`   Public: ${user.profile.isPublic ? 'Yes' : 'No'}`);
      } else {
        console.log(`   ⚠️  No profile created`);
      }
      console.log('');
    });

    // Check public profiles specifically
    const publicProfiles = await Profile.findAll({
      where: { isPublic: true },
      include: [{
        model: User,
        as: 'user'
      }]
    });

    console.log(`\n✅ Public profiles: ${publicProfiles.length}\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkProfiles();
