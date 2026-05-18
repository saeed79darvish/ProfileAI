/**
 * Job-related AI prompts
 * Prompts for job descriptions, skills, matching, and recruiter features
 */

/**
 * Generate interview questions prompt
 */
const interviewQuestionsPrompt = (profileData, roleContext = '') => `Based on this candidate's profile, generate 8-10 insightful technical and behavioral interview questions that would help assess their fit for a ${roleContext || 'senior technical'} role.
Candidate Profile:
Name: ${profileData.firstName} ${profileData.lastName}
Title: ${profileData.title}
Summary: ${profileData.summary || ''}
Skills: ${JSON.stringify(profileData.skills)}
Experience: ${JSON.stringify(profileData.experience).substring(0, 2000)}
Projects: ${JSON.stringify(profileData.projects).substring(0, 1000)}
Generate questions that:
1. Test their deep technical knowledge in their stated expertise
2. Explore their project experiences and problem-solving approach
3. Assess leadership and collaboration skills
4. Validate their career progression claims
5. Uncover their passion and motivation
Return as a JSON array with objects containing 'question' and 'rationale' fields:
[{"question": "...", "rationale": "Tests their understanding of...", "category": "technical"}]`;

/**
 * Compare candidates prompt
 */
const compareCandidatesPrompt = (candidateSummaries, jobRequirements) => `As a hiring manager, compare these candidates for a role with the following requirements:
Job Requirements:
${jobRequirements}
${candidateSummaries}
Provide:
1. Ranking from best to least fit (with scores 0-100)
2. Key differentiators for each candidate
3. Potential concerns or red flags
4. Best-fit recommendation with reasoning
Return as JSON:
{
  "rankings": [{"candidateIndex": 0, "score": 95, "strengths": [...], "concerns": [...], "recommendation": "..."}],
  "summary": "Overall comparison summary...",
  "topPick": 0
}`;

/**
 * Predict salary range prompt
 */
const predictSalaryPrompt = (profileData, location = 'US', currency = 'USD') => `Based on this professional profile, predict a realistic salary range in ${location} (${currency}).
Title: ${profileData.title}
Skills: ${JSON.stringify(profileData.skills)}
Experience: ${(profileData.experience || []).length} positions (${JSON.stringify(profileData.experience).substring(0, 1500)})
Education: ${JSON.stringify(profileData.education).substring(0, 500)}
Location: ${profileData.location || location}
Consider:
1. Years of experience and career level
2. Professional skills and their market demand
3. Industry standards for this role
4. Geographic location
Return as JSON:
{
  "minSalary": 70000,
  "maxSalary": 100000,
  "medianSalary": 85000,
  "currency": "${currency}",
  "confidence": "high|medium|low",
  "factors": ["5+ years experience", "In-demand professional skills", "Management experience"],
  "marketInsight": "Brief insight about salary trends for this profile"
}`;

/**
 * Generate outreach message prompt
 */
const outreachMessagePrompt = (profileData, jobDetails, tone = 'professional') => `Generate a personalized recruiting outreach message for this candidate.
Candidate Profile:
Name: ${profileData.firstName} ${profileData.lastName}
Title: ${profileData.title}
Summary: ${profileData.summary || ''}
Key Strengths: ${JSON.stringify(profileData.aiStrengths || [])}
Recent Experience: ${JSON.stringify((profileData.experience || [])[0])}
Job Details:
${jobDetails}
Message Requirements:
- Tone: ${tone} (professional/friendly/enthusiastic)
- Reference specific aspects of their profile that match the role
- Highlight why this opportunity is compelling
- Include a clear call-to-action
- Keep it concise (200-300 words)
Generate three variations: email subject line, LinkedIn message, and email body.
Return as JSON:
{
  "emailSubject": "...",
  "linkedInMessage": "...",
  "emailBody": "...",
  "personalizedHighlights": ["Noticed your work on...", "Your experience with..."]
}`;

/**
 * Analyze skill gaps prompt
 */
const skillGapsPrompt = (profileData, jobRequirements) => `Analyze this candidate's profile against job requirements and identify skill gaps and areas of excellence.
Candidate Skills: ${JSON.stringify(profileData.skills)}
Candidate Experience: ${JSON.stringify(profileData.experience).substring(0, 2000)}
Job Requirements:
${jobRequirements}
Provide detailed analysis:
Return as JSON:
{
  "matchScore": 85,
  "strongMatches": ["Project Management", "Data Analysis", "Team Leadership"],
  "partialMatches": ["Budget Planning - has experience but not extensive"],
  "gaps": ["Specific industry certification", "International experience"],
  "transferableSkills": ["Strong analytical skills transfer to financial modeling"],
  "developmentPlan": "Brief recommendation on how to close gaps",
  "hiringRecommendation": "Strong hire with minor upskilling needed in...",
  "readinessLevel": "immediate|1-2 months|3-6 months"
}`;

/**
 * Predict culture fit prompt
 */
const cultureFitPrompt = (profileData, companyValues) => `Analyze this candidate's profile and predict their cultural fit with a company.
Candidate Profile:
Title: ${profileData.title}
Summary: ${profileData.summary || ''}
Experience: ${JSON.stringify(profileData.experience).substring(0, 2000)}
Projects: ${JSON.stringify(profileData.projects).substring(0, 1000)}
Company Values & Culture:
${companyValues}
Based on their career choices, project selections, and work history patterns, assess:
1. Leadership style and collaboration preferences
2. Innovation and risk-taking appetite
3. Work pace preference (startup vs corporate)
4. Learning orientation
5. Values alignment
Return as JSON:
{
  "overallFitScore": 85,
  "fitDimensions": {
    "leadership": {"score": 90, "insight": "..."},
    "innovation": {"score": 85, "insight": "..."},
    "collaboration": {"score": 80, "insight": "..."},
    "pace": {"score": 85, "insight": "..."}
  },
  "redFlags": [],
  "greenFlags": ["History of contributing to open source", "Progressive career growth"],
  "interviewFocusAreas": ["Assess their comfort with ambiguity", "Explore team collaboration style"],
  "recommendation": "Strong cultural fit with minor validation needed on..."
}`;

/**
 * Generate job description prompt
 */
const jobDescriptionPrompt = (basicInfo) => `Create a compelling, professional job description based on these requirements:
Title: ${basicInfo.title}
Company: ${basicInfo.companyName}
Department: ${basicInfo.department || 'Not specified'}
Experience Level: ${basicInfo.experienceLevel}
Work Mode: ${basicInfo.workMode}
Key Skills Needed: ${JSON.stringify(basicInfo.requiredSkills)}
Additional Notes: ${basicInfo.notes || 'None'}
Write a professional job description with these sections:
About the Role
[2-3 engaging sentences about the position and its impact]
What You'll Do
- Responsibility 1
- Responsibility 2
- Responsibility 3
- Responsibility 4
- Responsibility 5
What We're Looking For
- Requirement 1
- Requirement 2
- Requirement 3
- Requirement 4
Nice to Have
- Optional skill 1
- Optional skill 2
- Optional skill 3
Why Join Us
[1-2 sentences about company culture and growth opportunity]
IMPORTANT RULES:
1. Do NOT use emojis, asterisks, or special formatting characters
2. Use simple dashes (-) for bullet points
3. Use plain section titles without any symbols
4. Write clean, professional text that can be easily copied anywhere`;

/**
 * Suggest skills for role prompt
 */
const suggestSkillsPrompt = (jobTitle, industry) => `For a ${jobTitle} position in the ${industry} industry, suggest:
1. Required/Must-have skills (5-8 skills)
2. Preferred/Nice-to-have skills (5-8 skills)
3. Soft skills that matter (3-5 skills)
Return as JSON:
{
  "required": ["skill1", "skill2"],
  "preferred": ["skill3", "skill4"],
  "soft": ["communication", "teamwork"]
}`;

/**
 * Generate screening questions prompt
 */
const screeningQuestionsPrompt = (projectData, numberOfQuestions = 5) => `Generate ${numberOfQuestions} insightful screening questions for this role:
Job Title: ${projectData.title}
Required Skills: ${JSON.stringify(projectData.requiredSkills)}
Experience Level: ${projectData.experienceLevel}
Key Responsibilities: ${JSON.stringify(projectData.responsibilities || []).substring(0, 500)}
Create questions that:
1. Assess technical competency
2. Evaluate cultural fit
3. Understand motivation and career goals
4. Are specific to this role (not generic)
Return as JSON array:
[
  {
    "question": "Question text here?",
    "purpose": "What this question assesses",
    "category": "technical|behavioral|situational"
  }
]`;

module.exports = {
  interviewQuestionsPrompt,
  compareCandidatesPrompt,
  predictSalaryPrompt,
  outreachMessagePrompt,
  skillGapsPrompt,
  cultureFitPrompt,
  jobDescriptionPrompt,
  suggestSkillsPrompt,
  screeningQuestionsPrompt
};
