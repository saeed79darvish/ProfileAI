const { JobScreening } = require('../models');

async function check() {
  const s = await JobScreening.findOne({ 
    where: { jobId: '5fd98f7f-f518-4f50-9a01-46b94f909faf' }, 
    order: [['createdAt', 'DESC']] 
  });
  
  if (s) {
    console.log('=== SCREENING CONFIG ===');
    console.log(JSON.stringify(s.screeningConfig, null, 2));
    console.log('\nuseAgentArena:', s.screeningConfig?.useAgentArena);
  } else {
    console.log('No screening found');
  }
  
  process.exit(0);
}

check();
