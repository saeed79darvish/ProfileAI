/**
 * Test Script: Phone screening call for VP in Ads position
 * 
 * Usage: cd backend && node scripts/triggerCall.js
 */

require('dotenv').config();
const axios = require('axios');

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;

// Test phone number - UPDATE THIS TO YOUR NUMBER
const TEST_PHONE_NUMBER = '+16507728846';

// VP in Ads position details
const testJob = {
  title: 'VP of Advertising',
  company: 'AdTech Global',
  description: `We are seeking an experienced Vice President of Advertising to lead our advertising division. 
This role will be responsible for developing and executing comprehensive advertising strategies, 
managing a team of 50+ professionals, and driving revenue growth through innovative ad solutions.`,
  requirements: [
    '10+ years of advertising/marketing leadership experience',
    'Proven track record of managing large advertising budgets ($50M+)',
    'Experience with digital advertising platforms (Google Ads, Meta, programmatic)',
    'Strong leadership and team management skills',
    'MBA or equivalent preferred',
    'Experience in B2B and B2C advertising campaigns'
  ],
  salary: '$250,000 - $350,000 + bonus + equity',
  location: 'San Francisco, CA (Hybrid)'
};

// Candidate details
const testCandidate = {
  firstName: 'Test',
  lastName: 'Candidate',
  skills: ['Digital Advertising', 'Programmatic', 'Team Leadership', 'Revenue Growth', 'Google Ads', 'Meta Ads'],
  headline: 'Senior Director of Advertising | 12 Years Experience'
};

async function makeVPAdsCall() {
  console.log('\n📞 VP in Ads Position - Phone Screening Test\n');
  console.log('='.repeat(50) + '\n');
  
  // Check for required env vars
  if (!VAPI_API_KEY) {
    console.error('❌ Error: VAPI_API_KEY is not set in .env file');
    console.log('\nTo get your API key:');
    console.log('1. Go to https://vapi.ai');
    console.log('2. Sign up/login');
    console.log('3. Go to Dashboard → API Keys');
    console.log('4. Copy your API key');
    console.log('5. Add to backend/.env: VAPI_API_KEY=your_key_here\n');
    process.exit(1);
  }
  
  if (!VAPI_PHONE_NUMBER_ID) {
    console.error('❌ Error: VAPI_PHONE_NUMBER_ID is not set in .env file');
    console.log('\nTo get a phone number:');
    console.log('1. Go to https://dashboard.vapi.ai/phone-numbers');
    console.log('2. Buy or import a phone number');
    console.log('3. Copy the phone number ID');
    console.log('4. Add to backend/.env: VAPI_PHONE_NUMBER_ID=your_phone_id_here\n');
    process.exit(1);
  }
  
  console.log(`✓ VAPI_API_KEY: ${VAPI_API_KEY.substring(0, 10)}...`);
  console.log(`✓ VAPI_PHONE_NUMBER_ID: ${VAPI_PHONE_NUMBER_ID}`);
  console.log(`✓ Calling: ${TEST_PHONE_NUMBER}\n`);
  
  console.log('📋 Job Details:');
  console.log(`   Position: ${testJob.title}`);
  console.log(`   Company: ${testJob.company}`);
  console.log(`   Salary: ${testJob.salary}`);
  console.log(`   Location: ${testJob.location}\n`);
  
  const vapiClient = axios.create({
    baseURL: 'https://api.vapi.ai',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  try {
    // Step 1: Create an assistant for VP in Ads screening
    console.log('Creating VP Ads screening assistant...');
    
    const systemPrompt = `You are a professional executive recruiter conducting a phone screening interview for ${testJob.company}. 
You are screening candidates for the ${testJob.title} position - this is a senior executive role.

## About the Position
- Job Title: ${testJob.title}
- Company: ${testJob.company}
- Compensation: ${testJob.salary}
- Location: ${testJob.location}
- Description: ${testJob.description}
- Key Requirements: ${testJob.requirements.join(', ')}

## About the Candidate
- Name: ${testCandidate.firstName} ${testCandidate.lastName}
- Current Role: ${testCandidate.headline}
- Key Skills: ${testCandidate.skills.join(', ')}

## Interview Guidelines
1. **Duration**: Keep the call to approximately 8-10 minutes
2. **Tone**: Be warm but professional - this is an executive-level conversation
3. **Consent**: At the start, inform them this call is being recorded for quality purposes
4. **Structure**: 
   - Brief introduction and verify interest
   - Ask about their advertising leadership experience
   - Discuss budget management experience
   - Ask about team management and growth strategies
   - Gauge interest in hybrid work arrangement
   - Thank them and explain next steps

## Key Questions for VP in Ads Role
1. "Can you tell me about your current role and what draws you to this VP of Advertising opportunity?"
2. "What's the largest advertising budget you've managed, and what results did you achieve?"
3. "How do you approach building and leading a high-performing advertising team?"
4. "What's your experience with programmatic advertising and emerging ad technologies?"
5. "How do you measure advertising effectiveness and ROI across different channels?"

Be conversational and adapt to their responses. Listen for leadership qualities, strategic thinking, and results-driven mindset.`;

    const COMPANY_NAME = process.env.COMPANY_NAME || 'ProfileAI Executive Search';

    const assistantResponse = await vapiClient.post('/assistant', {
      name: `${COMPANY_NAME} - VP Ads Screen`,
      model: {
        provider: 'openai',
        model: 'gpt-4-turbo',
        temperature: 0.7,
        systemPrompt: systemPrompt,
        maxTokens: 400
      },
      voice: {
        provider: 'openai',
        voiceId: 'alloy'
      },
      firstMessage: `Hi! This is the executive recruiting team calling from ${testJob.company} about the Vice President of Advertising position. Before we begin, I want to let you know this call is being recorded for quality purposes. Is now a good time to chat for about 10 minutes?`,
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'en'
      },
      endCallFunctionEnabled: true,
      endCallMessage: 'Thank you so much for your time today! Based on our conversation, I think you could be a great fit for this VP role. Our team will review your qualifications and be in touch within the next few days. Have a wonderful day!',
      maxDurationSeconds: 600, // 10 minutes max
      silenceTimeoutSeconds: 30,
      recordingEnabled: true
    });
    
    const assistantId = assistantResponse.data.id;
    console.log(`✓ Assistant created: ${assistantId}\n`);
    
    // Step 2: Initiate the call
    console.log('Initiating phone call...');
    
    const callResponse = await vapiClient.post('/call/phone', {
      assistantId: assistantId,
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: {
        number: TEST_PHONE_NUMBER,
        name: `${testCandidate.firstName} ${testCandidate.lastName}`
      },
      metadata: {
        testCall: true,
        jobTitle: testJob.title,
        company: testJob.company,
        timestamp: new Date().toISOString()
      }
    });
    
    const callId = callResponse.data.id;
    console.log(`✓ Call initiated!`);
    console.log(`  Call ID: ${callId}`);
    console.log(`  Status: ${callResponse.data.status}\n`);
    
    console.log('='.repeat(50));
    console.log('📱 Your phone should ring shortly!');
    console.log('='.repeat(50) + '\n');
    
    console.log('Call Details:');
    console.log(`- To: ${TEST_PHONE_NUMBER}`);
    console.log(`- Position: ${testJob.title}`);
    console.log(`- Duration Limit: 10 minutes`);
    console.log(`- Recording: Enabled\n`);
    
    console.log('After the call ends, you can check:');
    console.log(`- Vapi Dashboard: https://dashboard.vapi.ai/calls/${callId}`);
    console.log('- Call transcript and recording will be available there\n');
    
    // Poll for call status
    console.log('Monitoring call status (Ctrl+C to exit)...\n');
    
    let lastStatus = '';
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await vapiClient.get(`/call/${callId}`);
        const status = statusResponse.data.status;
        
        if (status !== lastStatus) {
          const timestamp = new Date().toLocaleTimeString();
          console.log(`[${timestamp}] Call status: ${status}`);
          lastStatus = status;
          
          if (['ended', 'failed'].includes(status)) {
            clearInterval(pollInterval);
            console.log('\n✓ Call completed!\n');
            
            if (statusResponse.data.transcript) {
              console.log('--- Transcript ---');
              console.log(statusResponse.data.transcript);
              console.log('------------------\n');
            }
            
            if (statusResponse.data.summary) {
              console.log('--- Call Summary ---');
              console.log(statusResponse.data.summary);
              console.log('--------------------\n');
            }
            
            // Cleanup: delete the test assistant
            try {
              await vapiClient.delete(`/assistant/${assistantId}`);
              console.log('✓ Test assistant cleaned up');
            } catch (e) {
              // Ignore cleanup errors
            }
            
            process.exit(0);
          }
        }
      } catch (e) {
        // Ignore polling errors
      }
    }, 2000);
    
    // Timeout after 15 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      console.log('\n⏰ Monitoring timeout reached');
      process.exit(0);
    }, 900000);
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\nYour VAPI_API_KEY appears to be invalid.');
    } else if (error.response?.status === 400) {
      console.log('\nCheck your VAPI_PHONE_NUMBER_ID - it may be incorrect.');
    }
    
    process.exit(1);
  }
}

makeVPAdsCall();
