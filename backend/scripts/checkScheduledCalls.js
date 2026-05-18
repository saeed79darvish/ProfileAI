require('dotenv').config();
const { PhoneScreeningCall, Interview } = require('../models');

(async () => {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 5 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 1 * 60 * 1000);
    
    console.log('Current time:', now.toISOString());
    console.log('Time window: -5min to +1min');
    console.log('Window start:', windowStart.toISOString());
    console.log('Window end:', windowEnd.toISOString());
    console.log();
    
    const calls = await PhoneScreeningCall.findAll({
      where: { status: 'scheduled' },
      include: [{ model: Interview, as: 'Interview' }],
      order: [['scheduledAt', 'ASC']],
      limit: 20
    });
    
    console.log(`Found ${calls.length} scheduled phone screening calls`);
    console.log();
    
    if (calls.length === 0) {
      console.log('No scheduled calls found. All calls are either in the past or already processed.');
    } else {
      calls.forEach(call => {
        const scheduledTime = new Date(call.scheduledAt);
        const inWindow = scheduledTime >= windowStart && scheduledTime <= windowEnd;
        const minutesFromNow = Math.round((scheduledTime - now) / (60 * 1000));
        
        console.log(`Call ID: ${call.id.substring(0, 8)}`);
        console.log(`  Scheduled: ${call.scheduledAt.toISOString()} (${minutesFromNow > 0 ? '+' : ''}${minutesFromNow} min from now)`);
        console.log(`  Interview Status: ${call.Interview?.status || 'MISSING'}`);
        console.log(`  Interview ID: ${call.Interview?.id?.substring(0, 8) || 'MISSING'}`);
        console.log(`  Candidate Phone: ${call.candidatePhone || 'MISSING'}`);
        console.log(`  In Time Window: ${inWindow ? '✅ YES - SHOULD CALL NOW' : '❌ NO'}`);
        console.log();
      });
      
      const inWindowCalls = calls.filter(c => {
        const scheduledTime = new Date(c.scheduledAt);
        return scheduledTime >= windowStart && scheduledTime <= windowEnd;
      });
      
      console.log(`Calls in current window: ${inWindowCalls.length}`);
      if (inWindowCalls.length > 0) {
        console.log('✅ These calls should be initiated by the scheduler');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
