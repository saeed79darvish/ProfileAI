const { Interview } = require('../models');

(async () => {
  try {
    // Update all interviews to enable phone screening
    const [updatedCount] = await Interview.update(
      { 
        phoneScreeningEnabled: true,
        phoneScreeningDuration: 15
      },
      { 
        where: { 
          phoneScreeningEnabled: false
        } 
      }
    );
    
    console.log(`✅ Updated ${updatedCount} interviews to enable phone screening`);
    console.log('Now when you reschedule these interviews, phone screening calls will be created.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
