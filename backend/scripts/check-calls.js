const { Interview, PhoneScreeningCall } = require('../models');

async function check() {
  // Check interviews with phone screening enabled
  const interviews = await Interview.findAll({
    where: { phoneScreeningEnabled: true },
    order: [['updatedAt', 'DESC']],
    limit: 5
  });
  
  console.log('=== Recent Interviews with Phone Screening Enabled ===');
  interviews.forEach(i => {
    console.log({
      id: i.id.substring(0,8),
      status: i.status,
      scheduledAt: i.scheduledAt,
      phoneScreeningCallId: i.phoneScreeningCallId ? i.phoneScreeningCallId.substring(0,8) : null
    });
  });
  
  // Check all phone screening calls
  const calls = await PhoneScreeningCall.findAll({
    order: [['createdAt', 'DESC']],
    limit: 5
  });
  
  console.log('\n=== Phone Screening Calls ===');
  if (calls.length === 0) {
    console.log('No phone screening calls found');
  } else {
    calls.forEach(c => {
      console.log({
        id: c.id.substring(0,8),
        status: c.status,
        scheduledAt: c.scheduledAt,
        interviewId: c.interviewId ? c.interviewId.substring(0,8) : null,
        candidatePhone: c.candidatePhone
      });
    });
  }
  
  // Check scheduled calls specifically
  const scheduled = await PhoneScreeningCall.findAll({
    where: { status: ['scheduled', 'pending'] }
  });
  console.log('\n=== Pending/Scheduled Calls:', scheduled.length, '===');
  
  process.exit(0);
}

check();
