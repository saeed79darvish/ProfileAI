const { Interview, PhoneScreeningCall } = require('../models');

async function rescheduleCall() {
  try {
    // Schedule for 2 minutes from now
    const newScheduledAt = new Date(Date.now() + 2 * 60 * 1000);
    
    console.log('Current time:', new Date().toISOString());
    console.log('New scheduled time:', newScheduledAt.toISOString());
    
    // Update the PhoneScreeningCall
    const call = await PhoneScreeningCall.findByPk('e945eb7e-8712-4d9f-b4d5-e8d8884787b8');
    if (!call) {
      console.log('PhoneScreeningCall not found');
      return;
    }
    
    await call.update({
      scheduledAt: newScheduledAt,
      status: 'scheduled'
    });
    console.log('✅ PhoneScreeningCall updated');
    
    // Update the Interview
    const interview = await Interview.findByPk('ddbe8d5e-88dd-4cef-84cc-729d3e5d4a71');
    if (interview) {
      await interview.update({ scheduledAt: newScheduledAt });
      console.log('✅ Interview updated');
    }
    
    console.log('\n📞 The scheduler will pick up this call in about 2 minutes');
    console.log('Watch the backend logs for scheduler activity');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

rescheduleCall();
