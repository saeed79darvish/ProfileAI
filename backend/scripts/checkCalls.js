const { PhoneScreeningCall, Interview, User, Profile } = require('../models');

async function checkCalls() {
  try {
    console.log('\n=== PhoneScreeningCalls Status ===\n');
    
    const calls = await PhoneScreeningCall.findAll({
      order: [['createdAt', 'DESC']],
      limit: 10,
      include: [{
        model: Interview,
        as: 'Interview'
      }]
    });
    
    console.log(`Found ${calls.length} PhoneScreeningCall records:\n`);
    
    const now = new Date();
    console.log('Current time:', now.toISOString());
    console.log('');
    
    for (const call of calls) {
      console.log('---');
      console.log('Call ID:', call.id);
      console.log('  Status:', call.status);
      console.log('  Scheduled At:', call.scheduledAt ? call.scheduledAt.toISOString() : 'NOT SET');
      console.log('  Candidate Phone:', call.candidatePhone);
      console.log('  Call Attempts:', call.callAttempts, '/', call.maxAttempts);
      console.log('  Interview ID:', call.interviewId);
      if (call.Interview) {
        console.log('  Interview Status:', call.Interview.status);
      }
      if (call.errorMessage) {
        console.log('  Error:', call.errorMessage);
      }
      
      // Check if this call should be triggered
      if (call.scheduledAt && call.status === 'scheduled') {
        const scheduledTime = new Date(call.scheduledAt);
        const timeDiff = (now - scheduledTime) / 1000 / 60; // in minutes
        if (timeDiff > 0) {
          console.log('  ⚠️  OVERDUE by', timeDiff.toFixed(1), 'minutes');
        } else {
          console.log('  ⏰ Will trigger in', (-timeDiff).toFixed(1), 'minutes');
        }
      }
    }
    
    console.log('\n\n=== Interviews with phoneScreeningEnabled ===\n');
    
    const interviews = await Interview.findAll({
      where: { phoneScreeningEnabled: true },
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    
    console.log(`Found ${interviews.length} interviews with phone screening:\n`);
    
    for (const interview of interviews) {
      console.log('---');
      console.log('Interview ID:', interview.id);
      console.log('  Status:', interview.status);
      console.log('  Scheduled At:', interview.scheduledAt ? interview.scheduledAt.toISOString() : 'NOT SET');
      console.log('  Phone Screening Call ID:', interview.phoneScreeningCallId || 'NOT LINKED');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkCalls();
