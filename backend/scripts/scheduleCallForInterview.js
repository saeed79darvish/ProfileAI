const { Interview, PhoneScreeningCall, Job, User, Profile } = require('../models');
const callSchedulerService = require('../services/callSchedulerService');

async function scheduleCallForInterview() {
  try {
    const interviewId = 'ac09a978-e63f-4e67-8d76-3285b5d9072c';
    
    // First, enable phone screening on the interview
    const interview = await Interview.findByPk(interviewId, {
      include: [
        { model: Job, as: 'job' },
        { model: User, as: 'candidate', include: [{ model: Profile, as: 'profile' }] }
      ]
    });
    
    if (!interview) {
      console.log('Interview not found');
      process.exit(1);
    }
    
    console.log('Interview found:', interview.id);
    console.log('Candidate:', interview.candidate?.firstName, interview.candidate?.lastName);
    console.log('Candidate phone:', interview.candidate?.profile?.phone);
    console.log('Scheduled at:', interview.scheduledAt);
    
    // Enable phone screening
    await interview.update({
      phoneScreeningEnabled: true,
      phoneScreeningDuration: 15
    });
    console.log('Phone screening enabled');
    
    // Create the phone screening call using the service
    const phoneCall = await callSchedulerService.scheduleCall(interviewId, {
      duration: 15
    });
    
    console.log('Phone screening call scheduled:', phoneCall.id);
    console.log('Call status:', phoneCall.status);
    console.log('Call scheduled at:', phoneCall.scheduledAt);
    
    // Update interview with call ID
    await interview.update({ phoneScreeningCallId: phoneCall.id });
    console.log('Interview updated with call ID');
    
    console.log('\n✅ Done! The AI agent should call at the scheduled time.');
    
  } catch (err) {
    console.error('Error:', err.message, err.stack);
  }
  process.exit(0);
}

scheduleCallForInterview();
