const { Interview, PhoneScreeningCall, User, Profile } = require('../models');
const callSchedulerService = require('../services/callSchedulerService');

async function createMissingPhoneScreeningCalls() {
  try {
    // Find all confirmed interviews with phone screening enabled but no phone screening call
    const interviews = await Interview.findAll({
      where: {
        status: 'confirmed',
        phoneScreeningEnabled: true,
        phoneScreeningCallId: null,
        scheduledAt: {
          [require('sequelize').Op.not]: null
        }
      },
      include: [
        { 
          model: User, 
          as: 'candidate',
          include: [{ model: Profile, as: 'profile' }]
        }
      ]
    });

    console.log(`Found ${interviews.length} interviews needing phone screening calls`);

    for (const interview of interviews) {
      try {
        // Check if candidate has a phone number
        const candidatePhone = interview.candidate?.profile?.phone;
        if (!candidatePhone) {
          console.log(`  ⚠️  Skipping interview ${interview.id.substring(0,8)} - no phone number`);
          continue;
        }

        // Create the phone screening call
        const phoneScreening = await callSchedulerService.scheduleCall(interview.id, {
          duration: interview.phoneScreeningDuration || 15
        });
        
        // Link it to the interview
        await interview.update({ phoneScreeningCallId: phoneScreening.id });
        
        console.log(`  ✅ Created phone screening call ${phoneScreening.id.substring(0,8)} for interview ${interview.id.substring(0,8)} scheduled at ${interview.scheduledAt}`);
      } catch (error) {
        console.error(`  ❌ Failed to create call for interview ${interview.id}:`, error.message);
      }
    }

    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createMissingPhoneScreeningCalls();
