const axios = require('axios');
const { PhoneScreeningCall, Interview, Job, User, Profile } = require('../models');
const aiService = require('./aiService');

const VAPI_API_URL = 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;

// Axios instance for Vapi API
const vapiClient = axios.create({
  baseURL: VAPI_API_URL,
  headers: {
    'Authorization': `Bearer ${VAPI_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Format phone number to E.164 format
 * Assumes US numbers if no country code provided
 */
function formatPhoneToE164(phone) {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // If already has country code (11+ digits starting with 1 for US)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If 10 digits (US number without country code), add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If already in E.164 format (starts with +)
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // For other formats, try to add + if not present
  return digits.length > 10 ? `+${digits}` : `+1${digits}`;
}

/**
 * Create a dynamic screening assistant tailored to the job and candidate
 */
async function createScreeningAssistant(job, candidate, candidateProfile, options = {}) {
  const { duration = 15 } = options;
  
  const systemPrompt = buildScreeningSystemPrompt(job, candidate, candidateProfile, duration);
  const firstMessage = buildFirstMessage(candidate.firstName || 'there', job.title, job.company);
  
  // Create a short, unique name that fits within 40 chars
  const shortId = job.id.split('-')[0]; // First segment of UUID
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits
  const assistantName = `Screen-${shortId}-${timestamp}`;
  
  try {
    const response = await vapiClient.post('/assistant', {
      name: assistantName,
      model: {
        provider: 'openai',
        model: 'gpt-4-turbo',
        temperature: 0.7,
        systemPrompt: systemPrompt,
        maxTokens: 500
      },
      voice: {
        provider: 'openai',
        voiceId: 'alloy' // OpenAI's built-in voice
      },
      firstMessage: firstMessage,
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'en'
      },
      endCallFunctionEnabled: true,
      endCallMessage: `Thank you so much for your time today. We really appreciate you speaking with us about the ${job.title} position. Our team will review everything and get back to you soon. Have a great day!`,
      maxDurationSeconds: duration * 60,
      backgroundSound: 'office',
      silenceTimeoutSeconds: 30,
      responseDelaySeconds: 0.5,
      interruptionsEnabled: true,
      recordingEnabled: true,
      hipaaEnabled: false,
      metadata: {
        jobId: job.id,
        candidateProfileId: candidateProfile.id,
        companyName: job.company
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error creating Vapi assistant:', error.response?.data || error.message);
    throw new Error(`Failed to create screening assistant: ${error.message}`);
  }
}

/**
 * Build the system prompt for the screening assistant
 */
function buildScreeningSystemPrompt(job, candidate, candidateProfile, durationMinutes) {
  const skills = candidateProfile.skills || [];
  const experience = candidateProfile.experience || [];
  // Handle requirements as either string or array
  const jobRequirements = job.requirements || '';
  const requirementsDisplay = Array.isArray(jobRequirements) 
    ? jobRequirements.join(', ') 
    : jobRequirements;
  
  return `You are a professional AI recruiter conducting a phone screening interview for ${job.company}. 
Your role is to have a natural, conversational phone screening with a candidate for the ${job.title} position.

## About the Position
- Job Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location || 'Not specified'}
- Type: ${job.type || 'Full-time'}
- Description: ${job.description || 'Not provided'}
${requirementsDisplay ? `- Key Requirements: ${requirementsDisplay}` : ''}

## About the Candidate
- Name: ${candidate.firstName || ''} ${candidate.lastName || ''}
${skills.length > 0 ? `- Listed Skills: ${skills.join(', ')}` : ''}
${candidateProfile.headline ? `- Profile Headline: ${candidateProfile.headline}` : ''}
${experience.length > 0 ? `- Experience Summary: ${experience.slice(0, 3).map(e => e.title || e.role || 'Role').join(', ')}` : ''}

## Interview Guidelines
1. **Duration**: Keep the call to approximately ${durationMinutes} minutes
2. **Tone**: Be warm, professional, and conversational - not robotic
3. **Consent**: At the very start, inform them this call is being recorded for quality purposes
4. **Structure**: 
   - Brief introduction and rapport building (1-2 min)
   - Verify their interest in the role (1 min)
   - Ask about relevant experience and skills (5-7 min)
   - Situational/behavioral questions (3-5 min)
   - Answer any questions they have (2-3 min)
   - Explain next steps and thank them

## Key Questions to Ask
1. "Tell me a bit about yourself and what interests you about this role?"
2. "Can you walk me through your most relevant experience for this position?"
3. "What would you say are your strongest skills that align with this role?"
4. "Can you describe a challenging situation you faced at work and how you handled it?"
5. "What are your salary expectations and availability to start?"
6. "Do you have any questions about the role or company?"

## Evaluation Criteria
As you speak with the candidate, mentally assess:
- Communication skills (clarity, articulation, listening)
- Relevant experience and qualifications
- Cultural fit and enthusiasm
- Red flags or concerns
- Overall recommendation (strong yes, yes, maybe, no)

## Important Reminders
- Be adaptable - follow the natural flow of conversation
- Ask follow-up questions based on their responses
- Don't be too rigid with the script
- If they seem nervous, help them feel at ease
- Summarize what you heard to show active listening
- Be respectful of their time`;
}

/**
 * Build the first message the assistant will say
 */
function buildFirstMessage(firstName, jobTitle, companyName) {
  return `Hi ${firstName}! This is the AI recruiting assistant calling from ${companyName} about the ${jobTitle} position you applied for. Before we begin, I just want to let you know that this call will be recorded for quality and review purposes. Is that okay with you?`;
}

/**
 * Initiate a phone screening call
 */
async function initiateCall(phoneScreeningCallId) {
  const phoneScreening = await PhoneScreeningCall.findByPk(phoneScreeningCallId, {
    include: [
      { model: Interview, as: 'Interview', include: [{ model: Job, as: 'job' }] },
      { model: User, as: 'candidate', include: [{ model: Profile, as: 'profile' }] }
    ]
  });
  
  if (!phoneScreening) {
    throw new Error('Phone screening call not found');
  }
  
  const interview = phoneScreening.Interview;
  const job = interview?.job;
  const candidate = phoneScreening.candidate;
  const candidateProfile = candidate?.profile;
  
  if (!job || !candidateProfile) {
    throw new Error('Missing job or candidate profile data');
  }
  
  if (!phoneScreening.candidatePhone) {
    throw new Error('Candidate phone number is required');
  }
  
  // Format phone number to E.164
  const formattedPhone = formatPhoneToE164(phoneScreening.candidatePhone);
  if (!formattedPhone) {
    throw new Error('Could not format phone number to E.164 format');
  }
  
  try {
    // Create a dynamic assistant for this specific screening
    const assistant = await createScreeningAssistant(job, candidate, candidateProfile, {
      duration: phoneScreening.duration
    });
    
    // Update the phone screening with assistant ID
    await phoneScreening.update({
      vapiAssistantId: assistant.id,
      status: 'queued'
    });
    
    // Initiate the call via Vapi
    const callResponse = await vapiClient.post('/call/phone', {
      assistantId: assistant.id,
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: {
        number: formattedPhone,
        name: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim()
      },
      metadata: {
        phoneScreeningCallId: phoneScreening.id,
        interviewId: phoneScreening.interviewId,
        jobId: job.id,
        candidateId: candidate.id,
        recruiterId: phoneScreening.recruiterId
      }
    });
    
    // Update with Vapi call ID - use 'queued' to indicate call is with VAPI
    await phoneScreening.update({
      vapiCallId: callResponse.data.id,
      status: 'queued',
      callInitiatedAt: new Date()
    });
    
    console.log(`Initiated screening call ${phoneScreening.id}, Vapi call ID: ${callResponse.data.id}`);
    
    return {
      success: true,
      phoneScreeningId: phoneScreening.id,
      vapiCallId: callResponse.data.id
    };
  } catch (error) {
    console.error('Error initiating Vapi call:', error.response?.data || error.message);
    
    await phoneScreening.update({
      status: 'failed',
      failureReason: error.message
    });
    
    throw error;
  }
}

/**
 * Handle Vapi status update webhook
 */
async function handleStatusUpdate(payload) {
  const { call, status } = payload;
  
  if (!call?.id) {
    console.warn('Status update missing call ID');
    return;
  }
  
  const phoneScreening = await PhoneScreeningCall.findOne({
    where: { vapiCallId: call.id }
  });
  
  if (!phoneScreening) {
    console.warn(`Phone screening not found for Vapi call ${call.id}`);
    return;
  }
  
  // Map Vapi status to our status
  const statusMap = {
    'ringing': 'ringing',
    'in-progress': 'in_progress',
    'forwarding': 'in_progress',
    'ended': 'completed',
    'busy': 'busy',
    'no-answer': 'no_answer',
    'canceled': 'cancelled',
    'failed': 'failed'
  };
  
  const mappedStatus = statusMap[status] || phoneScreening.status;
  
  const updateData = {
    status: mappedStatus
  };
  
  // Track timing
  if (status === 'in-progress' && !phoneScreening.callStartedAt) {
    updateData.callStartedAt = new Date();
  }
  
  if (status === 'ended') {
    updateData.callEndedAt = new Date();
    if (call.endedReason) {
      updateData.endReason = call.endedReason;
    }
  }
  
  // Handle failed/no-answer for retry logic with exponential backoff
  if (['no-answer', 'busy', 'failed'].includes(status)) {
    const currentAttempts = phoneScreening.callAttempts || 0;
    const maxAttempts = phoneScreening.maxAttempts || 3;
    
    if (currentAttempts < maxAttempts) {
      // Exponential backoff: 10 min -> 20 min -> 40 min
      const baseMinutes = phoneScreening.retryAfterMinutes || 10;
      const multiplier = Math.pow(2, currentAttempts); // 0->1x, 1->2x, 2->4x
      const retryDelayMinutes = Math.min(baseMinutes * multiplier, 120); // Cap at 2 hours
      
      updateData.status = 'scheduled'; // Will be retried by scheduler
      updateData.callAttempts = currentAttempts + 1;
      updateData.nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);
      
      console.log(`📅 Retry ${currentAttempts + 1} scheduled in ${retryDelayMinutes} minutes`);
    }
  }
  
  await phoneScreening.update(updateData);
  
  console.log(`Updated phone screening ${phoneScreening.id} status to ${mappedStatus}`);
  
  return phoneScreening;
}

/**
 * Handle Vapi end-of-call report webhook
 */
async function handleEndOfCallReport(payload) {
  const { call, transcript, recordingUrl, summary, messages } = payload;
  
  if (!call?.id) {
    console.warn('End of call report missing call ID');
    return;
  }
  
  const phoneScreening = await PhoneScreeningCall.findOne({
    where: { vapiCallId: call.id },
    include: [
      { model: Interview, as: 'Interview', include: [{ model: Job, as: 'job' }] },
      { model: User, as: 'candidate', include: [{ model: Profile, as: 'profile' }] },
      { model: User, as: 'recruiter' }
    ]
  });
  
  if (!phoneScreening) {
    console.warn(`Phone screening not found for Vapi call ${call.id}`);
    return;
  }
  
  // Calculate actual call duration
  const durationSeconds = call.duration || 
    (phoneScreening.callStartedAt && phoneScreening.callEndedAt 
      ? Math.round((new Date(phoneScreening.callEndedAt) - new Date(phoneScreening.callStartedAt)) / 1000)
      : 0);
  
  // Update with transcript and recording
  await phoneScreening.update({
    status: 'completed',
    transcript: transcript,
    recordingUrl: recordingUrl,
    actualDuration: Math.round(durationSeconds / 60),
    callEndedAt: phoneScreening.callEndedAt || new Date()
  });
  
  // Analyze the transcript and generate screening report
  try {
    const job = phoneScreening.Interview?.job;
    const candidateProfile = phoneScreening.candidate?.profile;
    
    if (transcript && job && candidateProfile) {
      const analysis = await analyzeTranscript(transcript, job, candidateProfile);
      
      await phoneScreening.update({
        screeningScore: analysis.overallScore,
        screeningResult: analysis.screeningResult,
        recommendation: analysis.recommendation,
        scoreBreakdown: analysis.scoreBreakdown,
        extractedData: analysis.extractedData,
        strengths: analysis.strengths,
        concerns: analysis.concerns,
        aiSummary: analysis.summary
      });
      
      // Send results to recruiter via email
      const emailService = require('./emailService');
      await emailService.sendScreeningCallResults(phoneScreening.id);
    }
  } catch (analysisError) {
    console.error('Error analyzing transcript:', analysisError);
    // Don't fail the whole process if analysis fails
  }
  
  console.log(`Processed end of call report for phone screening ${phoneScreening.id}`);
  
  return phoneScreening;
}

/**
 * Analyze the call transcript using AI
 */
async function analyzeTranscript(transcript, job, candidateProfile) {
  const prompt = `You are an expert recruiter analyzing a phone screening call transcript. 
Evaluate the candidate's performance and provide a detailed assessment.

## Job Details
- Title: ${job.title}
- Company: ${job.company}
- Requirements: ${(job.requirements || []).join(', ') || 'Not specified'}
- Description: ${job.description || 'Not provided'}

## Candidate Background
- Name: ${candidateProfile.firstName} ${candidateProfile.lastName}
- Skills: ${(candidateProfile.skills || []).join(', ') || 'Not listed'}
- Headline: ${candidateProfile.headline || 'Not provided'}

## Call Transcript
${transcript}

## Your Task
Analyze this screening call and provide a JSON response with the following structure:
{
  "overallScore": <number 1-100>,
  "screeningResult": "<pass|fail|maybe>",
  "recommendation": "<strong_yes|yes|maybe|no|strong_no>",
  "summary": "<2-3 sentence summary of the candidate's performance>",
  "scoreBreakdown": {
    "communication": <1-100>,
    "relevantExperience": <1-100>,
    "technicalFit": <1-100>,
    "culturalFit": <1-100>,
    "enthusiasm": <1-100>
  },
  "extractedData": {
    "salaryExpectation": "<extracted salary range or null>",
    "availability": "<extracted availability or null>",
    "currentRole": "<extracted current role or null>",
    "yearsExperience": "<extracted years or null>",
    "noticePeriod": "<extracted notice period or null>"
  },
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "concerns": ["<concern 1>", "<concern 2>", ...],
  "notableQuotes": ["<relevant quote 1>", "<relevant quote 2>"],
  "followUpQuestions": ["<suggested follow-up question 1>", "<question 2>"]
}

Be objective and thorough in your assessment.`;

  try {
    const response = await aiService.generateText(prompt, {
      temperature: 0.3,
      maxTokens: 1500
    });
    
    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('Failed to parse AI analysis response');
  } catch (error) {
    console.error('Error in transcript analysis:', error);
    
    // Return a default analysis on error
    return {
      overallScore: 50,
      screeningResult: 'maybe',
      recommendation: 'maybe',
      summary: 'Unable to fully analyze the transcript. Manual review recommended.',
      scoreBreakdown: {
        communication: 50,
        relevantExperience: 50,
        technicalFit: 50,
        culturalFit: 50,
        enthusiasm: 50
      },
      extractedData: {},
      strengths: [],
      concerns: ['Automated analysis encountered an error'],
      notableQuotes: [],
      followUpQuestions: []
    };
  }
}

/**
 * Get the listen URL for human-in-the-loop
 */
async function getListenUrl(vapiCallId) {
  try {
    const response = await vapiClient.get(`/call/${vapiCallId}`);
    return {
      listenUrl: response.data.monitor?.listenUrl,
      controlUrl: response.data.monitor?.controlUrl
    };
  } catch (error) {
    console.error('Error getting listen URL:', error);
    throw error;
  }
}

/**
 * Transfer call to human recruiter
 */
async function transferToHuman(vapiCallId, phoneNumber) {
  try {
    const response = await vapiClient.post(`/call/${vapiCallId}/transfer`, {
      destination: {
        type: 'number',
        number: phoneNumber,
        message: 'Please hold while I transfer you to a human recruiter.'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error transferring call:', error);
    throw error;
  }
}

/**
 * End an active call
 */
async function endCall(vapiCallId) {
  try {
    const response = await vapiClient.post(`/call/${vapiCallId}/end`);
    return response.data;
  } catch (error) {
    console.error('Error ending call:', error);
    throw error;
  }
}

/**
 * Delete an assistant after use
 */
async function deleteAssistant(assistantId) {
  try {
    await vapiClient.delete(`/assistant/${assistantId}`);
    console.log(`Deleted Vapi assistant ${assistantId}`);
  } catch (error) {
    console.error('Error deleting assistant:', error);
    // Non-critical, don't throw
  }
}

/**
 * Get call details from Vapi
 */
async function getCallDetails(vapiCallId) {
  try {
    const response = await vapiClient.get(`/call/${vapiCallId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting call details:', error);
    throw error;
  }
}

module.exports = {
  createScreeningAssistant,
  initiateCall,
  handleStatusUpdate,
  handleEndOfCallReport,
  analyzeTranscript,
  getListenUrl,
  transferToHuman,
  endCall,
  deleteAssistant,
  getCallDetails
};
