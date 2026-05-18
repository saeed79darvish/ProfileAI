const { Interview, PhoneScreeningCall, Profile, Job } = require('../models');

async function fixInterview() {
  try {
    // Get the interview
    const interview = await Interview.findByPk('ddbe8d5e-88dd-4cef-84cc-729d3e5d4a71', {
      include: [{ model: Job, as: 'job' }]
    });
    
    if (!interview) {
      console.log('Interview not found');
      return;
    }

    console.log('Interview found:', interview.id);
    console.log('Current phoneScreeningEnabled:', interview.phoneScreeningEnabled);
    console.log('Scheduled at:', interview.scheduledAt);
    
    // Get candidate profile for phone number
    const profile = await Profile.findOne({ where: { userId: interview.candidateId } });
    const phone = profile?.phone;
    
    if (!phone) {
      console.log('No phone number found for candidate');
      return;
    }
    
    console.log('Candidate phone:', phone);
    console.log('Candidate name:', profile.fullName || 'Unknown');

    // Enable phone screening and create the call record
    const call = await PhoneScreeningCall.create({
      interviewId: interview.id,
      jobId: interview.jobId,
      candidateId: interview.candidateId,
      recruiterId: interview.recruiterId,
      candidatePhone: phone,
      candidateName: profile.fullName || 'Candidate',
      jobTitle: interview.job?.title || 'Position',
      companyName: interview.job?.company || 'Company',
      status: 'scheduled',
      scheduledAt: interview.scheduledAt,
      targetDurationMinutes: interview.phoneScreeningDuration || 15
    });
    
    console.log('Created PhoneScreeningCall:', call.id);
    
    // Update interview
    await interview.update({
      phoneScreeningEnabled: true,
      phoneScreeningCallId: call.id
    });
    
    console.log('✅ Interview updated with phone screening enabled');
    console.log('The scheduler will now pick up this call at the scheduled time');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixInterview();
