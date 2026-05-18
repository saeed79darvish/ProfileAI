require('dotenv').config();
const { Interview, PhoneScreeningCall } = require('../models');

(async () => {
  try {
    const interview = await Interview.findOne({
      where: { 
        status: 'confirmed',
        phoneScreeningEnabled: true 
      },
      order: [['scheduledAt', 'DESC']]
    });
    
    if (!interview) {
      console.log('No interviews with phone screening found');
      process.exit(0);
    }
    
    console.log('Interview ID:', interview.id.substring(0,8));
    console.log('Current scheduled:', interview.scheduledAt);
    console.log('Phone screening call ID:', interview.phoneScreeningCallId?.substring(0,8) || 'NONE');
    
    const newTime = new Date(Date.now() + 2 * 60 * 1000);
    await interview.update({ scheduledAt: newTime });
    console.log('✅ Rescheduled interview to:', newTime.toISOString());
    console.log('   That is 2 minutes from now');
    
    if (interview.phoneScreeningCallId) {
      const call = await PhoneScreeningCall.findByPk(interview.phoneScreeningCallId);
      if (call) {
        await call.update({
          scheduledAt: newTime,
          status: 'scheduled',
          callAttempts: 0,
          vapiCallId: null,
          errorMessage: null,
          endedReason: null
        });
        console.log('✅ Updated phone screening call to:', newTime.toISOString());
        console.log('\n🔔 PHONE CALL WILL HAPPEN IN ~2 MINUTES!');
        console.log('   Candidate phone:', call.candidatePhone);
        console.log('   Watch the backend logs for call initiation...');
      }
    } else {
      console.log('⚠️  Interview has no phone screening call linked');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
