const { PhoneScreeningCall, Interview } = require('../models');

async function checkCall() {
  try {
    const call = await PhoneScreeningCall.findByPk('e945eb7e-8712-4d9f-b4d5-e8d8884787b8');
    
    if (!call) {
      console.log('Call not found');
      return;
    }
    
    console.log('Call ID:', call.id);
    console.log('Status:', call.status);
    console.log('Scheduled At:', call.scheduledAt);
    console.log('Current Time:', new Date().toISOString());
    console.log('Call Attempts:', call.callAttempts);
    console.log('Last Error:', call.errorMessage);
    console.log('Vapi Call ID:', call.vapiCallId);
    
    // Check interview
    const interview = await Interview.findByPk(call.interviewId);
    if (interview) {
      console.log('\nInterview Status:', interview.status);
      console.log('Interview Confirmed:', interview.confirmedAt);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCall();
