// Quick test: send an email via Gmail SMTP
require('dotenv').config();
const emailService = require('../services/emailService');

async function testEmail() {
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✓ set' : '✗ not set');
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✓ set' : '✗ not set');
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM || '(not set, using default)');
  
  const result = await emailService.sendEmail({
    to: 's79darvish@gmail.com',
    subject: '✅ ProfileAI Email Test',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>ProfileAI Email Test</h2>
        <p>If you received this, Gmail SMTP is working correctly!</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      </div>
    `,
    text: 'ProfileAI Email Test - Gmail SMTP is working!'
  });
  
  console.log('\nResult:', result ? '✅ Email sent successfully!' : '❌ Email failed to send');
  process.exit(result ? 0 : 1);
}

testEmail();
