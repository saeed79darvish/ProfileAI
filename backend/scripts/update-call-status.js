const { PhoneScreeningCall, Interview, Notification } = require('../models');

async function updateCall() {
  // Mark the call as voicemail (candidate rejected/didn't answer)
  await PhoneScreeningCall.update(
    { 
      status: 'voicemail',
      endedReason: 'customer-did-not-answer',
      endedAt: new Date(),
      callAttempts: 1
    },
    { where: { id: 'a7b9d7c4-bcca-4e47-b52e-cdeed5f81f96' } }
  );
  console.log('Updated call status to voicemail');
  
  // Get the call details
  const call = await PhoneScreeningCall.findByPk('a7b9d7c4-bcca-4e47-b52e-cdeed5f81f96');
  
  // Notify candidate
  await Notification.create({
    userId: call.candidateId,
    type: 'phone_screening_missed',
    title: 'Missed Phone Screening Call',
    message: 'You missed the scheduled phone screening call. Please reschedule at your earliest convenience.',
    metadata: {
      phoneScreeningId: call.id,
      interviewId: call.interviewId,
      jobId: call.jobId
    },
    isRead: false
  });
  console.log('Created candidate notification');
  
  // Notify recruiter
  await Notification.create({
    userId: call.recruiterId,
    type: 'phone_screening_failed',
    title: 'Phone Screening - No Answer',
    message: 'The candidate did not answer the phone screening call. They will need to reschedule.',
    metadata: {
      phoneScreeningId: call.id,
      interviewId: call.interviewId,
      candidateId: call.candidateId
    },
    isRead: false
  });
  console.log('Created recruiter notification');
  
  process.exit(0);
}

updateCall().catch(err => {
  console.error(err);
  process.exit(1);
});
