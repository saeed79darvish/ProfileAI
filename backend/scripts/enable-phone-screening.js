const { Interview, Profile } = require('../models');
const callSchedulerService = require('../services/callSchedulerService');

async function enablePhoneScreening() {
  const interviewId = process.argv[2] || 'd3e28150-f218-406b-bb6d-76f4773ab5b4';
  
  const interview = await Interview.findByPk(interviewId);
  if (!interview) {
    console.log('Interview not found:', interviewId);
    process.exit(1);
  }
  
  console.log('Interview found:', {
    id: interview.id,
    status: interview.status,
    scheduledAt: interview.scheduledAt,
    phoneScreeningEnabled: interview.phoneScreeningEnabled,
    phoneScreeningCallId: interview.phoneScreeningCallId
  });
  
  // Check if candidate has phone number
  const profile = await Profile.findOne({ where: { userId: interview.candidateId } });
  console.log('Candidate phone:', profile?.phone || 'NOT SET');
  
  if (!profile?.phone) {
    console.log('ERROR: Candidate has no phone number in their profile!');
    console.log('Phone screening requires a phone number.');
    process.exit(1);
  }
  
  // Enable phone screening
  await interview.update({ phoneScreeningEnabled: true });
  console.log('✅ Phone screening enabled for interview');
  
  // Schedule the call
  try {
    const call = await callSchedulerService.scheduleCall(interview.id);
    await interview.update({ phoneScreeningCallId: call.id });
    console.log('✅ PhoneScreeningCall created:', {
      id: call.id,
      scheduledAt: call.scheduledAt,
      status: call.status,
      candidatePhone: call.candidatePhone
    });
  } catch (err) {
    console.error('Error scheduling call:', err.message);
  }
  
  process.exit(0);
}

enablePhoneScreening();
