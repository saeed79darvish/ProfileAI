const { Interview, Job } = require('../models');

async function checkDuplicateTimes() {
  const interviews = await Interview.findAll({
    where: { 
      candidateId: '10615ad6-717a-4074-a7c7-a59089b34b3d',
      status: 'confirmed' 
    },
    include: [{ model: Job, as: 'job', attributes: ['title'] }]
  });
  
  // Group by scheduledAt time
  const byTime = {};
  interviews.forEach(i => {
    const time = i.scheduledAt?.toISOString() || 'null';
    if (!byTime[time]) byTime[time] = [];
    byTime[time].push(i);
  });
  
  // Show only those with duplicates at same time
  const duplicates = Object.entries(byTime).filter(([t, list]) => list.length > 1);
  if (duplicates.length > 0) {
    console.log('Found interviews at same time:');
    duplicates.forEach(([time, list]) => {
      console.log('\nAt', time, '- Count:', list.length);
      list.forEach(i => console.log('  -', i.id.substring(0,8), i.job?.title));
    });
  } else {
    console.log('No duplicate times found');
  }
  
  // Also show today's interviews
  const today = new Date().toISOString().split('T')[0];
  const todayInterviews = interviews.filter(i => i.scheduledAt?.toISOString().startsWith(today));
  console.log('\nInterviews today (' + today + '):', todayInterviews.length);
  todayInterviews.forEach(i => {
    console.log('  -', i.id.substring(0,8), i.scheduledAt?.toISOString(), i.job?.title);
  });
  
  process.exit(0);
}

checkDuplicateTimes();
