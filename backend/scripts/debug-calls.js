require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PhoneScreeningCall, Interview } = require('../models');

async function check() {
  const now = new Date();
  console.log('Now:', now.toISOString());
  
  // Check recent interviews
  const interviews = await Interview.findAll({
    where: { phoneScreeningEnabled: true },
    order: [['updatedAt', 'DESC']],
    limit: 5,
    raw: true
  });
  
  console.log('\n=== RECENT INTERVIEWS ===');
  for (const i of interviews) {
    console.log('---');
    console.log('ID:', i.id.substring(0,8), '| status:', i.status);
    console.log('  scheduledAt:', i.scheduledAt);
    console.log('  updatedAt:', i.updatedAt);
    console.log('  phoneScreeningCallId:', i.phoneScreeningCallId);
    
    if (i.phoneScreeningCallId) {
      const call = await PhoneScreeningCall.findByPk(i.phoneScreeningCallId, { raw: true });
      if (call) {
        console.log('  >>> CALL status:', call.status, '| scheduledAt:', call.scheduledAt);
      }
    }
  }
  
  // All scheduled calls
  const scheduled = await PhoneScreeningCall.findAll({
    where: { status: 'scheduled' },
    raw: true
  });
  console.log('\n=== SCHEDULED CALLS:', scheduled.length, '===');
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });

check().catch(e => { console.error(e); process.exit(1); });
