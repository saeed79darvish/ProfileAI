require('dotenv').config();
const { Interview, PhoneScreeningCall } = require('../models');

(async () => {
  try {
    // Get a confirmed interview
    const interview = await Interview.findOne({
      where: { status: 'confirmed' },
      order: [['scheduledAt', 'DESC']]
    });
    
    if (!interview) {
      console.log('No confirmed interviews found');
      process.exit(0);
    }
    
    console.log(`Found interview: ${interview.id.substring(0, 8)}`);
    console.log(`Current scheduled time: ${interview.scheduledAt}`);
    
    // Schedule it for 2 minutes from now
    const newScheduledAt = new Date(Date.now() + 2 * 60 * 1000);
    
    await interview.update({
      scheduledAt: newScheduledAt
    });
    
    console.log(`✅ Rescheduled interview to: ${newScheduledAt.toISOString()}`);
    console.log(`   That's ${Math.round((newScheduledAt - new Date()) / 1000)} seconds from now`);
    
    // Update the phone screening call if it exists
    if (interview.phoneScreeningCallId) {
      const call = await PhoneScreeningCall.findByPk(interview.phoneScreeningCallId);
      if (call) {
        await call.update({
          scheduledAt: newScheduledAt,
          status: 'scheduled',
          callAttempts: 0,
          vapiCallId: null,
          errorMessage: null
        });
        console.log(`✅ Updated phone screening call to match`);
        console.log(`\n🔔 WATCH FOR THE CALL IN ~2 MINUTES!`);
        console.log(`   The scheduler will pick this up and initiate the call via Vapi`);
      }
    } else {
      console.log(`ℹ️  No phone screening call linked - phone screening may not be enabled`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
