require('dotenv').config();
const { PhoneScreeningCall, Interview } = require('../models');

(async () => {
  const call = await PhoneScreeningCall.findOne({
    where: { vapiCallId: '019bdfae-9d43-7000-8042-6330ea41ecd8' },
    include: [{ model: Interview, as: 'Interview' }]
  });
  
  console.log('📋 Phone Screening Details:');
  console.log('  ID:', call.id);
  console.log('  Interview ID:', call.interviewId);
  console.log('  Status:', call.status);
  console.log('  Has transcript:', call.transcript ? 'YES (' + call.transcript.length + ' chars)' : 'NO');
  console.log('  Has summary:', call.summary ? 'YES' : 'NO');
  console.log('  Has score:', call.screeningScore !== null ? 'YES (' + call.screeningScore + ')' : 'NO');
  console.log('  Interview status:', call.Interview?.status);
  console.log('\n✅ To view results, use this endpoint:');
  console.log('   GET /api/phone-screening/' + call.id + '/results');
  
  process.exit(0);
})();
