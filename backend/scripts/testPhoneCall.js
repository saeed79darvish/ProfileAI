/**
 * Test Script: Make a phone screening call via Vapi.ai
 * 
 * Usage: cd backend && node scripts/testPhoneCall.js
 * 
 * Required env vars:
 *   VAPI_API_KEY - Your Vapi.ai API key
 *   VAPI_PHONE_NUMBER_ID - Your Vapi phone number ID
 */

require('dotenv').config();
const axios = require('axios');

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;

// Test phone number
const TEST_PHONE_NUMBER = '+16282319869';

// Job details for the screening
const testJob = {
  title: 'Senior Software Engineer',
  company: 'TechCorp Inc',
  description: 'We are looking for an experienced software engineer to join our team.',
  requirements: ['5+ years experience', 'JavaScript', 'React', 'Node.js']
};

// Candidate details
const testCandidate = {
  firstName: 'Test',
  lastName: 'Candidate',
  skills: ['JavaScript', 'Python', 'React'],
  headline: 'Full Stack Developer'
};

async function makeTestCall() {
  console.log('\n📞 Vapi.ai Phone Screening Test\n');
  console.log('================================\n');
  
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
  
  const vapiClient = axios.create({
    baseURL: 'https://api.vapi.ai',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  try {
    // Step 1: Create an assistant for this screening
    console.log('Creating screening assistant...');
    
    const systemPrompt = `You are a professional AI recruiter conducting a phone screening interview for ${testJob.company}. 
Your role is to have a natural, conversational phone screening with a candidate for the ${testJob.title} position.

## About the Position
- Job Title: ${testJob.title}
- Company: ${testJob.company}
- Description: ${testJob.description}
- Key Requirements: ${testJob.requirements.join(', ')}

## About the Candidate
- Name: ${testCandidate.firstName} ${testCandidate.lastName}
- Skills: ${testCandidate.skills.join(', ')}
- Headline: ${testCandidate.headline}

## Interview Guidelines
1. **Duration**: Keep the call to approximately 5 minutes (this is a test call)
2. **Tone**: Be warm, professional, and conversational
3. **Consent**: At the very start, inform them this call is being recorded for quality purposes
4. **Structure**: 
   - Brief introduction
   - Verify their interest in the role
   - Ask 2-3 relevant questions
   - Thank them and explain next steps

## Key Questions to Ask
1. "Tell me a bit about yourself and what interests you about this role?"
2. "Can you briefly describe your most relevant experience?"
3. "Do you have any questions about the role?"

Be adaptable and follow the natural flow of conversation. This is a TEST call to verify the system is working.`;

    // Company name for caller ID context
    const COMPANY_NAME = process.env.COMPANY_NAME || 'ProfileAI Recruiting';

    const assistantResponse = await vapiClient.post('/assistant', {
      name: `${COMPANY_NAME} - Screening`,
      model: {
        provider: 'openai',
        model: 'gpt-4-turbo',
        temperature: 0.7,
        systemPrompt: systemPrompt,
        maxTokens: 300
      },
      voice: {
        provider: 'openai',
        voiceId: 'alloy'
      },
      firstMessage: `Hi! This is the AI recruiting assistant calling from ${testJob.company} about the ${testJob.title} position. This is a test call to verify our phone screening system. Before we begin, I want to let you know this call is being recorded. Is that okay with you?`,
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'en'
      },
      endCallFunctionEnabled: true,
      endCallMessage: 'Thank you for your time! This was a test call. Have a great day!',
      maxDurationSeconds: 300, // 5 minutes max for test
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
        timestamp: new Date().toISOString()
      }
    });
    
    const callId = callResponse.data.id;
    console.log(`✓ Call initiated!`);
    console.log(`  Call ID: ${callId}`);
    console.log(`  Status: ${callResponse.data.status}\n`);
    
    console.log('================================');
    console.log('📱 Your phone should ring shortly!');
    console.log('================================\n');
    
    console.log('Call Details:');
    console.log(`- To: ${TEST_PHONE_NUMBER}`);
    console.log(`- Duration Limit: 5 minutes`);
    console.log(`- Recording: Enabled\n`);
    
    console.log('After the call ends, you can check:');
    console.log(`- Vapi Dashboard: https://dashboard.vapi.ai/calls/${callId}`);
    console.log('- Call transcript and recording will be available there\n');
    
    // Optional: Poll for call status
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
    
    // Timeout after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      console.log('\n⏰ Monitoring timeout reached');
      process.exit(0);
    }, 600000);
    
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

makeTestCall();
