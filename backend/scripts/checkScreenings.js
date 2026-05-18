const { JobScreening } = require('../models');

(async () => {
  const screenings = await JobScreening.findAll({ 
    order: [['updatedAt', 'DESC']],
    limit: 5
  });
  screenings.forEach(s => {
    const r = s.searchResults || [];
    console.log('===');
    console.log('ID:', s.id.substring(0, 8));
    console.log('JobID:', s.jobId.substring(0, 8));
    console.log('Status:', s.status);
    console.log('Found:', r.length);
    console.log('Created:', s.createdAt?.toISOString());
    console.log('Updated:', s.updatedAt?.toISOString());
    if (r.length > 0) {
      console.log('Sample results:');
      r.slice(0, 3).forEach((c, i) => {
        console.log(`  ${i+1}. ${c.name} | Score:${c.score} | Skills:[${(c.skills || []).join(',')}] | Breakdown:${JSON.stringify(c.breakdown || {})}`);
      });
    }
  });
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
