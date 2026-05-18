const { PhoneScreeningCall, Interview, User, Profile, Job } = require('../models');
const { Op } = require('sequelize');

async function fixCalls() {
  try {
    // Fix calls with 'pending' status that should be 'scheduled'
    const [count] = await PhoneScreeningCall.update(
      { status: 'scheduled' },
      { where: { status: 'pending', callAttempts: 0 } }
    );
    console.log('✅ Fixed', count, 'calls from pending to scheduled');
    
    // Check for confirmed interviews with phoneScreeningEnabled but no call
    const interviews = await Interview.findAll({
      where: {
        phoneScreeningEnabled: true,
        status: 'confirmed',
        phoneScreeningCallId: null
      },
      include: [
        { 
          model: User, 
          as: 'candidate', 
          include: [{ model: Profile, as: 'profile' }] 
        },
        { model: Job, as: 'job' }
      ]
    });
    
    console.log('\nFound', interviews.length, 'confirmed interviews needing PhoneScreeningCall:\n');
    
    for (const interview of interviews) {
      console.log('- Interview', interview.id.substring(0, 8), 'scheduled for', interview.scheduledAt);
      const phone = interview.candidate?.profile?.phone;
      if (!phone) {
        console.log('  ⚠️ No phone number for candidate');
        continue;
      }
      console.log('  Candidate phone:', phone);
      
      // Create the missing PhoneScreeningCall
      const call = await PhoneScreeningCall.create({
        interviewId: interview.id,
        jobId: interview.jobId,
        candidateId: interview.candidateId,
        recruiterId: interview.recruiterId,
        candidatePhone: phone,
        candidateName: `${interview.candidate.firstName} ${interview.candidate.lastName}`,
        jobTitle: interview.job?.title,
        companyName: interview.job?.company,
        scheduledAt: interview.scheduledAt,
        targetDurationMinutes: interview.phoneScreeningDuration || 15,
        maxAttempts: 3,
        status: 'scheduled'
      });
      
      // Link the call to the interview
      await interview.update({ phoneScreeningCallId: call.id });
      
      console.log('  ✅ Created PhoneScreeningCall:', call.id.substring(0, 8));
    }
    
    // Show final status
    console.log('\n=== Final Status ===\n');
    
    const allCalls = await PhoneScreeningCall.findAll({
      where: { status: 'scheduled' },
      order: [['scheduledAt', 'ASC']]
    });
    
    const now = new Date();
    console.log('Current time:', now.toISOString());
    console.log('Scheduled calls:', allCalls.length);
    
    for (const call of allCalls) {
      const scheduled = new Date(call.scheduledAt);
      const diffMin = (scheduled - now) / 1000 / 60;
      const timeStr = diffMin > 0 
        ? `in ${diffMin.toFixed(0)} minutes`
        : `${Math.abs(diffMin).toFixed(0)} minutes ago`;
      console.log(`  - ${call.id.substring(0,8)}: ${call.candidatePhone} @ ${call.scheduledAt.toISOString()} (${timeStr})`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fixCalls();
