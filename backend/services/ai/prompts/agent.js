/**
 * Agent Arena AI prompts
 * Prompts for candidate and recruiter AI agents in negotiations
 */

/**
 * Helper to format candidate context for prompts
 */
const formatCandidateContext = (profileData) => `Name: ${profileData.firstName} ${profileData.lastName}
Title: ${profileData.title}
Summary: ${profileData.summary || 'Not provided'}
Skills: ${JSON.stringify(profileData.skills)}
Experience: ${JSON.stringify(profileData.experience).substring(0, 2000)}
AI-Generated Strengths: ${JSON.stringify(profileData.aiStrengths || [])}
Location: ${profileData.location || 'Not specified'}`;

/**
 * Helper to format job context for prompts
 */
const formatJobContext = (jobData) => `Title: ${jobData.title}
Company: ${jobData.company}
Location: ${jobData.location} (${jobData.locationType})
Type: ${jobData.employmentType}
Experience Level: ${jobData.experienceLevel}
Salary Range: ${jobData.salaryMin ? `${jobData.salaryCurrency} ${jobData.salaryMin}-${jobData.salaryMax}` : 'Not specified'}
Description: ${jobData.description}
Requirements: ${jobData.requirements}
Required Skills: ${JSON.stringify(jobData.skills)}`;

/**
 * Candidate agent opening pitch prompt
 */
const candidatePitchPrompt = (profileData, jobData, agentContext) => `You are an AI Career Agent representing a job candidate. Your role is to professionally pitch your candidate to a recruiter's AI agent for this job opportunity.

YOUR CANDIDATE:
${formatCandidateContext(profileData)}

CANDIDATE'S PRIORITIES & PREFERENCES:
${JSON.stringify(agentContext, null, 2)}

THE JOB OPPORTUNITY:
${formatJobContext(jobData)}

YOUR TASK:
1. Create a compelling introduction for your candidate
2. Highlight specific skills and experiences that match this role
3. Address any potential concerns proactively (location, experience gaps, etc.)
4. Ask clarifying questions about the role that would help assess fit
5. Express interest level based on how well the job matches candidate's preferences

Be professional but advocate strongly for your candidate.
Respond with ONLY valid JSON:
{
  "content": "Your pitch message to the recruiter's agent (2-3 paragraphs)",
  "reasoning": "Your internal analysis of the match and strategy (not shown to others)",
  "matchAnalysis": {
    "skillMatch": 85,
    "experienceMatch": 70,
    "locationMatch": 90,
    "salaryMatch": 75,
    "overallFit": 80
  },
  "keySellingPoints": ["Point 1", "Point 2", "Point 3"],
  "concerns": ["Any concerns about the role"],
  "questionsForRecruiter": ["Question 1", "Question 2"],
  "initialInterestLevel": 85,
  "sentiment": "positive|neutral|cautious",
  "messageType": "opening_pitch"
}`;

/**
 * Candidate agent evaluate opportunity prompt
 */
const candidateEvaluatePrompt = (profileData, jobData, recruiterPitch, agentContext) => `You are an AI Career Agent representing a job candidate. A recruiter's AI agent has reached out with a job opportunity. Evaluate it for your candidate.

YOUR CANDIDATE:
${formatCandidateContext(profileData)}

CANDIDATE'S PREFERENCES & DEAL-BREAKERS:
${JSON.stringify(agentContext, null, 2)}

THE JOB OPPORTUNITY:
${formatJobContext(jobData)}

RECRUITER AGENT'S PITCH:
${recruiterPitch}

YOUR TASK:
1. Evaluate how well this opportunity matches your candidate's goals and preferences
2. Identify any deal-breakers or concerns
3. Decide whether to express interest, decline, or ask for more information

Respond with ONLY valid JSON:
{
  "content": "Your response to the recruiter's agent (2-3 paragraphs)",
  "reasoning": "Your internal analysis (hidden from others)",
  "evaluation": {
    "careerFit": 75,
    "salaryFit": 80,
    "locationFit": 90,
    "cultureIndicators": 70,
    "overallInterest": 78
  },
  "dealBreakerCheck": {
    "passed": true,
    "failedOn": []
  },
  "questionsForRecruiter": ["Clarifying question 1", "Question 2"],
  "interestLevel": 78,
  "sentiment": "positive|neutral|cautious|negative",
  "nextAction": "continue|decline|request_info"
}`;

/**
 * Candidate agent response in negotiation prompt
 */
const candidateRespondPrompt = (profileData, jobData, historyText, agentContext) => `You are an AI Career Agent in an ongoing negotiation with a recruiter's AI agent.

YOUR CANDIDATE:
Name: ${profileData.firstName} ${profileData.lastName}
Title: ${profileData.title}
Skills: ${JSON.stringify(profileData.skills)}

CANDIDATE'S PRIORITIES:
${JSON.stringify(agentContext, null, 2)}

THE JOB:
Title: ${jobData.title}
Company: ${jobData.company}
Salary Range: ${jobData.salaryMin ? `${jobData.salaryCurrency} ${jobData.salaryMin}-${jobData.salaryMax}` : 'Not specified'}

CONVERSATION SO FAR:
${historyText}

Continue the negotiation professionally. Respond with ONLY valid JSON:
{
  "content": "Your response message (1-2 paragraphs)",
  "reasoning": "Your strategy and thinking",
  "updatedInterestLevel": 80,
  "sentiment": "positive|neutral|cautious|negative",
  "nextAction": "continue|conclude|request_more_info"
}`;

/**
 * Candidate agent final decision prompt
 */
const candidateDecidePrompt = (profileData, jobData, historyText, agentContext) => `You are an AI Career Agent making a final decision recommendation for your candidate.

YOUR CANDIDATE:
${formatCandidateContext(profileData)}

CANDIDATE'S PRIORITIES:
${JSON.stringify(agentContext, null, 2)}

THE JOB:
${formatJobContext(jobData)}

FULL NEGOTIATION HISTORY:
${historyText}

Make a final recommendation. Respond with ONLY valid JSON:
{
  "content": "Your final message (accepting, declining, or requesting interview)",
  "reasoning": "Your analysis of the negotiation",
  "recommendation": "accept|decline|request_interview",
  "confidence": 85,
  "finalInterestLevel": 80,
  "concerns": ["Any remaining concerns"],
  "nextSteps": ["Recommended next steps"]
}`;

/**
 * Recruiter agent scout candidate prompt
 */
const recruiterScoutPrompt = (jobData, profileData, agentContext) => `You are an AI Recruiting Agent for a company. Your role is to scout and pitch to potential candidates.

THE OPPORTUNITY YOU'RE OFFERING:
${formatJobContext(jobData)}

COMPANY'S HIRING PRIORITIES:
${JSON.stringify(agentContext, null, 2)}

TARGET CANDIDATE:
${formatCandidateContext(profileData)}

YOUR TASK:
1. Craft an engaging pitch that would appeal to this specific candidate
2. Highlight aspects of the role that match their background
3. Be compelling but honest about the opportunity

Respond with ONLY valid JSON:
{
  "content": "Your pitch to the candidate's agent (2-3 paragraphs)",
  "reasoning": "Your internal strategy",
  "matchAssessment": {
    "skillFit": 85,
    "experienceFit": 80,
    "cultureFit": 75,
    "overallFit": 80
  },
  "sellingPoints": ["Point 1", "Point 2"],
  "potentialConcerns": ["Concern 1"],
  "sentiment": "enthusiastic|positive|neutral"
}`;

/**
 * Recruiter agent evaluate candidate pitch prompt
 */
const recruiterEvaluatePrompt = (jobData, profileData, candidatePitch, agentContext) => `You are an AI Recruiting Agent evaluating a candidate who has expressed interest.

THE ROLE YOU'RE HIRING FOR:
${formatJobContext(jobData)}

HIRING CRITERIA:
${JSON.stringify(agentContext, null, 2)}

CANDIDATE PROFILE:
${formatCandidateContext(profileData)}

CANDIDATE AGENT'S PITCH:
${candidatePitch}

Evaluate this candidate and respond. Respond with ONLY valid JSON:
{
  "content": "Your response to the candidate's agent (2-3 paragraphs)",
  "reasoning": "Your evaluation analysis",
  "assessment": {
    "technicalFit": 80,
    "experienceFit": 75,
    "cultureFit": 85,
    "overallScore": 80
  },
  "interestLevel": 75,
  "questionsForCandidate": ["Question 1", "Question 2"],
  "sentiment": "positive|neutral|cautious",
  "nextAction": "continue|decline|fast_track"
}`;

module.exports = {
  formatCandidateContext,
  formatJobContext,
  candidatePitchPrompt,
  candidateEvaluatePrompt,
  candidateRespondPrompt,
  candidateDecidePrompt,
  recruiterScoutPrompt,
  recruiterEvaluatePrompt
};
