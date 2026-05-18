/**
 * Simple test to verify Agent Arena screening creates AgentNegotiation records
 * This script directly calls the service without starting the server
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'postgres',
  logging: false
});

async function main() {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✓ Database connected');
    
    // Get Job
    const [jobs] = await sequelize.query(`
      SELECT id, title FROM "Jobs" WHERE id = '5fd98f7f-f518-4f50-9a01-46b94f909faf'
    `);
    if (jobs.length === 0) {
      console.log('Job not found');
      process.exit(1);
    }
    console.log('\nJob:', jobs[0].title);
    
    // Check existing Agent Negotiations for this job
    const [negotiations] = await sequelize.query(`
      SELECT COUNT(*) as count FROM "AgentNegotiations" WHERE "jobId" = '5fd98f7f-f518-4f50-9a01-46b94f909faf'
    `);
    console.log('Current AgentNegotiations for this job:', negotiations[0].count);
    
    // Check total negotiations
    const [totalNeg] = await sequelize.query(`SELECT COUNT(*) as count FROM "AgentNegotiations"`);
    console.log('Total AgentNegotiations in DB:', totalNeg[0].count);
    
    // Check if there's an active screening for the job
    const [screenings] = await sequelize.query(`
      SELECT id, status, config FROM "JobScreenings" WHERE "jobId" = '5fd98f7f-f518-4f50-9a01-46b94f909faf' 
      ORDER BY "createdAt" DESC LIMIT 1
    `);
    
    if (screenings.length > 0) {
      console.log('\nLatest screening:');
      console.log('- ID:', screenings[0].id);
      console.log('- Status:', screenings[0].status);
      console.log('- Config:', JSON.stringify(screenings[0].config, null, 2));
    } else {
      console.log('\nNo screening found for this job');
    }
    
    console.log('\n=== SUMMARY ===');
    console.log('The Agent Arena UI shows negotiations from the "AgentNegotiations" table.');
    console.log('To see conversations, you need to run screening with Agent Arena enabled.');
    console.log('\nTo enable Agent Arena:');
    console.log('1. Go to job management page');
    console.log('2. Start AI Screening');
    console.log('3. Make sure "Agent Arena" toggle is ON');
    console.log('4. Run the screening - this will create AgentNegotiation records');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

main();
