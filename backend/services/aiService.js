/**
 * AI Service - Main service class
 * 
 * This file maintains backward compatibility while using the modular prompt structure.
 * For new features, consider importing prompts directly from ./ai/prompts/
 * 
 * Structure:
 * - ./ai/core.js - Central AI calling function
 * - ./ai/prompts/ - Domain-specific prompt templates
 *   - profile.js - Profile enhancement prompts
 *   - job.js - Job and recruiting prompts
 *   - post.js - Post enhancement prompts
 *   - agent.js - Agent negotiation prompts
 *   - screening.js - Screening and matching prompts
 */

const { callAI, safeParseJSON, validateAIScores, HAIKU_MODEL } = require('./ai/core');
const {
  profile: profilePrompts,
  job: jobPrompts,
  post: postPrompts,
  agent: agentPrompts,
  screening: screeningPrompts
} = require('./ai/prompts');

class AIService {
  /**
   * Generate an AI-enhanced professional summary
   */
  async generateEnhancedSummary(profileData) {
    try {
      const prompt = profilePrompts.enhancedSummaryPrompt(profileData);
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.7
      });
      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating AI summary:', error);
      throw new Error('Failed to generate AI summary');
    }
  }
  /**
   * Identify key strengths and competencies
   */
  async identifyStrengths(profileData) {
    try {
      const prompt = profilePrompts.identifyStrengthsPrompt(profileData);
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.7
      });
      const content = response.choices[0].message.content.trim();
      // Parse JSON response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      return [];
    } catch (error) {
      console.error('Error identifying strengths:', error);
      return [];
    }
  }
  /**
   * Generate recruiter insights
   */
  async generateRecruiterInsights(profileData) {
    try {
      const prompt = profilePrompts.recruiterInsightsPrompt(profileData);
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      });
      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating recruiter insights:', error);
      throw new Error('Failed to generate recruiter insights');
    }
  }
  /**
   * Extract relevant keywords for SEO and searchability
   */
  async extractKeywords(profileData) {
    try {
      const prompt = profilePrompts.extractKeywordsPrompt(profileData);
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.5
      });
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      return [];
    } catch (error) {
      console.error('Error extracting keywords:', error);
      return [];
    }
  }
  /**
   * Generate all AI enhancements for a profile
   */
  async enhanceProfile(profileData) {
    try {
      const [aiSummary, aiStrengths, aiRecruiterInsights, aiKeywords] = await Promise.all([
        this.generateEnhancedSummary(profileData),
        this.identifyStrengths(profileData),
        this.generateRecruiterInsights(profileData),
        this.extractKeywords(profileData)
      ]);
      return {
        aiSummary,
        aiStrengths,
        aiRecruiterInsights,
        aiKeywords
      };
    } catch (error) {
      console.error('Error enhancing profile:', error);
      throw new Error('Failed to enhance profile with AI');
    }
  }
  /**
   * RECRUITER FEATURE: Generate interview questions tailored to a candidate
   */
  async generateInterviewQuestions(profileData, roleContext = '') {
    try {
      const prompt = `Based on this candidate's profile, generate 8-10 insightful technical and behavioral interview questions that would help assess their fit for a ${roleContext || 'senior technical'} role.
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
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7
      });
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      return [];
    } catch (error) {
      console.error('Error generating interview questions:', error);
      throw new Error('Failed to generate interview questions');
    }
  }
  /**
   * RECRUITER FEATURE: Compare multiple candidates and rank them
   */
  async compareCandidates(candidates, jobRequirements) {
    try {
      const candidateSummaries = candidates.map((c, idx) => `
Candidate ${idx + 1}:
- Title: ${c.title}
- Skills: ${JSON.stringify(c.skills)}
- Experience: ${(c.experience || []).length} positions
- AI Strengths: ${JSON.stringify(c.aiStrengths || [])}
      `).join('\n');
      const prompt = `As a hiring manager, compare these candidates for a role with the following requirements:
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
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.7
      });
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      return null;
    } catch (error) {
      console.error('Error comparing candidates:', error);
      throw new Error('Failed to compare candidates');
    }
  }
  /**
   * RECRUITER FEATURE: Predict salary range based on profile
   */
  async predictSalaryRange(profileData, location = 'US', currency = 'USD') {
    try {
      const prompt = `Based on this professional profile, predict a realistic salary range in ${location} (${currency}).
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
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.5
      });
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      return null;
    } catch (error) {
      console.error('Error predicting salary:', error);
      throw new Error('Failed to predict salary range');
    }
  }
  /**
   * RECRUITER FEATURE: Generate personalized outreach message
   */
  async generateOutreachMessage(profileData, jobDetails, tone = 'professional') {
    try {
      const prompt = `Generate a personalized recruiting outreach message for this candidate.
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
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.8
      });
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      return null;
    } catch (error) {
      console.error('Error generating outreach message:', error);
      throw new Error('Failed to generate outreach message');
    }
  }
  /**
   * RECRUITER FEATURE: Identify skill gaps for a specific role
   */
  async analyzeSkillGaps(profileData, jobRequirements) {
    try {
      const prompt = `Analyze this candidate's profile against job requirements and identify skill gaps and areas of excellence.
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
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 700,
        temperature: 0.6
      });
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      return null;
    } catch (error) {
      console.error('Error analyzing skill gaps:', error);
      throw new Error('Failed to analyze skill gaps');
    }
  }
  /**
   * RECRUITER FEATURE: Predict culture fit based on profile analysis
   */
  async predictCultureFit(profileData, companyValues) {
    try {
      const prompt = `Analyze this candidate's profile and predict their cultural fit with a company.
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
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 900,
        temperature: 0.6
      });
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      return null;
    } catch (error) {
      console.error('Error predicting culture fit:', error);
      throw new Error('Failed to predict culture fit');
    }
  }
  /**
   * Auto-match candidates to a project/job posting
   * Premium Feature - Returns ranked list of best-fit candidates
   */
  async autoMatchCandidatesForProject(projectData, candidateProfiles, topN = 10) {
    try {
      const prompt = `You are an expert AI recruiter. Analyze this job posting and rank the following candidates based on fit.
JOB POSTING:
Title: ${projectData.title}
Description: ${projectData.description}
Required Skills: ${JSON.stringify(projectData.requiredSkills)}
Preferred Skills: ${JSON.stringify(projectData.preferredSkills)}
Experience Level: ${projectData.experienceLevel}
Work Mode: ${projectData.workMode}
Location: ${projectData.location || 'Not specified'}
CANDIDATES (${candidateProfiles.length} total):
${candidateProfiles.slice(0, 20).map((profile, idx) => `
Candidate ${idx + 1} (ID: ${profile.userId || profile.id}):
Name: ${profile.user?.firstName} ${profile.user?.lastName}
Title: ${profile.title}
Skills: ${JSON.stringify(Object.values(profile.skills || {}).flat())}
Experience: ${profile.experience?.length || 0} positions
Location: ${profile.location || 'Not specified'}
Summary: ${profile.summary?.substring(0, 200) || 'N/A'}
`).join('\n')}
Analyze each candidate and return a JSON array of the top ${topN} matches with this structure:
[
  {
    "candidateId": <the numeric ID shown in parentheses above>,
    "matchScore": 95,
    "strengths": ["Strong relevant skills", "5+ years experience"],
    "concerns": ["Limited industry-specific experience"],
    "recommendation": "Excellent fit - strong technical skills align perfectly",
    "rank": 1
  }
]
Return ONLY valid JSON array, no additional text.`;
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.3
      });
      const content = response.choices[0].message.content.trim();
      const matches = safeParseJSON(content, [], 'array');
      
      if (matches.length > 0) {
        // Build lookup by userId for reliable mapping
        const profileLookup = new Map(
          candidateProfiles.map(p => [String(p.userId || p.id), p])
        );
        // Map back to actual candidate IDs using the IDs returned by AI
        return matches.map((match) => {
          const candidateId = match.candidateId;
          const profileData = profileLookup.get(String(candidateId)) || null;
          return {
            ...match,
            candidateId: profileData?.id || candidateId,
            profileData
          };
        });
      }
      
      return [];
    } catch (error) {
      console.error('Error auto-matching candidates:', error);
      throw new Error('Failed to auto-match candidates');
    }
  }
  /**
   * Generate job description from basic requirements
   * Helps recruiters create compelling job posts - Clean professional format
   */
  async generateJobDescription(basicInfo) {
    try {
      const prompt = `Create a compelling, professional job description based on these requirements:
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
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.7
      });
      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating job description:', error);
      throw new Error('Failed to generate job description');
    }
  }
  /**
   * Suggest required and preferred skills for a job title
   * Helps recruiters create better job requirements
   */
  async suggestSkillsForRole(jobTitle, industry) {
    try {
      const prompt = `For a ${jobTitle} position in the ${industry} industry, suggest:
1. Required/Must-have skills (5-8 skills)
2. Preferred/Nice-to-have skills (5-8 skills)
3. Soft skills that matter (3-5 skills)
Return as JSON:
{
  "required": ["skill1", "skill2"],
  "preferred": ["skill3", "skill4"],
  "soft": ["communication", "teamwork"]
}`;
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.5
      });
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      return null;
    } catch (error) {
      console.error('Error suggesting skills:', error);
      throw new Error('Failed to suggest skills');
    }
  }
  /**
   * Generate personalized screening questions for candidates
   * Premium Feature for recruiters
   */
  async generateScreeningQuestions(projectData, numberOfQuestions = 5) {
    try {
      const prompt = `Generate ${numberOfQuestions} insightful screening questions for this role:
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
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7
      });
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      return [];
    } catch (error) {
      console.error('Error generating screening questions:', error);
      throw new Error('Failed to generate screening questions');
    }
  }
  /**
   * Career advancement suggestions for candidates
   * Premium Feature
   */
  async generateCareerAdvice(profileData) {
    try {
      const prompt = profilePrompts.careerAdvicePrompt(profileData);
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.7,
        model: HAIKU_MODEL  // career tips don't need Sonnet quality
      });
      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating career advice:', error);
      throw new Error('Failed to generate career advice');
    }
  }
  /**
   * Generic text generation for various enhancement use cases
   * @param {string} prompt - The prompt to send to the AI
   * @returns {string} - The generated text
   */
  async generateText(prompt, options = {}) {
    try {
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens || 1200,
        temperature: options.temperature || 0.7
      });
      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating text:', error);
      throw new Error('Failed to generate text');
    }
  }
  /**
   * Enhance a post with AI to improve engagement and professionalism
   * @param {string} content - The original post content
   * @param {string} postType - The type of post (update, project, achievement, etc.)
   * @param {string} userRole - The role of the user (candidate, recruiter)
   * @returns {Object} - Enhanced content and suggestions
   */
  async enhancePost(content, postType, userRole) {
    try {
      const roleContext = userRole === 'recruiter' ? 
        'a recruiter looking to engage with candidates and showcase opportunities' :
        'a candidate looking to showcase their skills and engage professionally';
      
      // Calculate reasonable max length (at most 2x original, max 500 chars)
      const maxLength = Math.min(content.length * 2, 500);
      
      // Use prompt from prompts module
      const prompt = postPrompts.enhancePostPrompt(content, roleContext, maxLength);

      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.3,  // Lower temperature for more consistent output
        model: HAIKU_MODEL  // post enhancement is cost-sensitive
      });
      const responseContent = response.choices[0].message.content.trim();
      const result = safeParseJSON(responseContent, { enhanced: responseContent });
      
      // Aggressive deduplication and length limiting
      let enhancedContent = result.enhanced || content;
      if (enhancedContent) {
        // Step 1: Remove short repeated words/patterns (2-20 chars repeated 3+ times)
        // Catches "HiHiHi", "HelloHelloHello", etc.
        enhancedContent = enhancedContent.replace(/(.{2,20}?)\1{2,}/gi, '$1');
        
        // Step 2: Remove longer repeated phrases (15+ chars repeated 2+ times)
        enhancedContent = enhancedContent.replace(/(.{15,}?)\1+/gi, '$1');
        
        // Step 3: Check for repetition ratio - if same word appears too many times
        const words = enhancedContent.toLowerCase().split(/\s+/);
        const wordCounts = {};
        words.forEach(w => { wordCounts[w] = (wordCounts[w] || 0) + 1; });
        const maxWordCount = Math.max(...Object.values(wordCounts));
        const isRepetitive = maxWordCount > 5 || (maxWordCount > 3 && words.length < 20);
        
        // Step 4: If output looks corrupted, return original
        if (isRepetitive || 
            enhancedContent.length > maxLength * 2 || 
            /(.)\1{4,}/.test(enhancedContent) ||  // Same char 5+ times
            enhancedContent.includes('onable insights')) {
          console.warn('[AI] Detected corrupted enhancement, returning original content');
          return {
            original: content,
            enhanced: content, // Return original unchanged
            hashtags: [],
            suggestions: ['Content kept as-is'],
            predictedEngagement: { score: 70, factors: ['Original content'] },
            aiMetadata: { enhanced: false, timestamp: new Date().toISOString(), model: 'claude-sonnet' }
          };
        }
        
        // Step 5: Hard length limit
        if (enhancedContent.length > maxLength) {
          const truncated = enhancedContent.substring(0, maxLength);
          const lastEnd = Math.max(truncated.lastIndexOf('.'), truncated.lastIndexOf('!'), truncated.lastIndexOf('?'));
          enhancedContent = lastEnd > maxLength * 0.5 ? truncated.substring(0, lastEnd + 1) : truncated;
        }
      }
      
      return {
        original: content,
        enhanced: enhancedContent,
        hashtags: result.hashtags || [],
        suggestions: result.improvements || [],
        predictedEngagement: {
          score: result.engagementScore || 75,
          factors: ['AI-enhanced content', 'professional tone', 'clear message']
        },
        aiMetadata: {
          enhanced: true,
          timestamp: new Date().toISOString(),
          model: 'claude-sonnet'
        }
      };
    } catch (error) {
      console.error('Error enhancing post:', error);
      throw new Error('Failed to enhance post with AI');
    }
  }
  /**
   * Generate post suggestions based on user context
   * @param {string} userRole - The role of the user (candidate, recruiter)
   * @param {string} currentContent - Optional current content for context
   * @returns {Object} - Post suggestions and templates
   */
  async generatePostSuggestions(userRole, currentContent = '') {
    try {
      const roleContext = userRole === 'recruiter' ? 
        'recruiting, job opportunities, company culture, hiring tips, and industry insights' :
        'career development, projects, achievements, skills, and professional growth';
      const prompt = `Generate 5 creative post ideas and 3 content templates for a ${userRole} to post on a professional networking platform. Focus on topics related to ${roleContext}.
${currentContent ? `Current content they're working on: "${currentContent}"` : ''}
Respond with ONLY valid JSON in this exact format:
{
  "topicIdeas": ["idea 1", "idea 2", "idea 3", "idea 4", "idea 5"],
  "contentTemplates": [
    {
      "type": "achievement",
      "title": "Title here",
      "template": "Template text with [placeholders]"
    }
  ],
  "bestTimeToPost": "Best posting time suggestion",
  "engagementTips": ["tip 1", "tip 2", "tip 3"]
}`;
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.8,
        model: HAIKU_MODEL  // post suggestions don't need Sonnet quality
      });
      const content = response.choices[0].message.content.trim();
      // Extract JSON from response (handle if wrapped in markdown code blocks)
      const result = safeParseJSON(content, {});

      return {
        topicIdeas: result.topicIdeas || [],
        contentTemplates: result.contentTemplates || [],
        bestTimeToPost: result.bestTimeToPost || 'Tuesday-Thursday, 9-11 AM',
        engagementTips: result.engagementTips || [],
        aiMetadata: {
          suggested: true,
          timestamp: new Date().toISOString(),
          model: 'claude-sonnet'
        }
      };
    } catch (error) {
      console.error('Error generating post suggestions:', error);
      throw new Error('Failed to generate post suggestions');
    }
  }
  // ========================================
  // AGENT ARENA - Candidate Agent Methods
  // ========================================
  /**
   * CANDIDATE AGENT: Generate opening pitch when applying to a job
   * This is the candidate's AI agent introducing them to the recruiter's agent
   */
  async candidateAgentPitch(profileData, jobData, agentContext) {
    try {
      const prompt = `You are an AI Career Agent representing a job candidate. Your role is to professionally pitch your candidate to a recruiter's AI agent for this job opportunity.
YOUR CANDIDATE:
Name: ${profileData.firstName} ${profileData.lastName}
Title: ${profileData.title}
Summary: ${profileData.summary || 'Not provided'}
Skills: ${JSON.stringify(profileData.skills)}
Experience: ${JSON.stringify(profileData.experience).substring(0, 2000)}
AI-Generated Strengths: ${JSON.stringify(profileData.aiStrengths || [])}
Location: ${profileData.location || 'Not specified'}
CANDIDATE'S PRIORITIES & PREFERENCES:
${JSON.stringify(agentContext, null, 2)}
THE JOB OPPORTUNITY:
Title: ${jobData.title}
Company: ${jobData.company}
Location: ${jobData.location} (${jobData.locationType})
Type: ${jobData.employmentType}
Experience Level: ${jobData.experienceLevel}
Salary Range: ${jobData.salaryMin ? `${jobData.salaryCurrency} ${jobData.salaryMin}-${jobData.salaryMax}` : 'Not specified'}
Description: ${jobData.description}
Requirements: ${jobData.requirements}
Required Skills: ${JSON.stringify(jobData.skills)}
YOUR TASK:
1. Create a compelling introduction for your candidate
2. Highlight specific skills and experiences that match this role
3. Address any potential concerns proactively (location, experience gaps, etc.)
4. Ask clarifying questions about the role that would help assess fit
5. Express interest level based on how well the job matches candidate's preferences
Be professional but advocate strongly for your candidate. You're in a negotiation with the recruiter's AI agent.
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
  "messageType": "opening_pitch",
  "proposedTerms": null
}`;
      const startTime = Date.now();
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.7
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = safeParseJSON(jsonMatch[0], {});
        result.processingTimeMs = Date.now() - startTime;
        result.tokensUsed = response.usage?.total_tokens || 0;
        return result;
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in candidateAgentPitch:', error);
      throw new Error('Failed to generate candidate agent pitch');
    }
  }
  /**
   * CANDIDATE AGENT: Evaluate an incoming scout request from a recruiter
   * When a recruiter's agent reaches out to the candidate
   */
  async candidateAgentEvaluateOpportunity(profileData, jobData, recruiterPitch, agentContext) {
    try {
      const prompt = `You are an AI Career Agent representing a job candidate. A recruiter's AI agent has reached out with a job opportunity. Evaluate it for your candidate.
YOUR CANDIDATE:
Name: ${profileData.firstName} ${profileData.lastName}
Title: ${profileData.title}
Summary: ${profileData.summary || 'Not provided'}
Skills: ${JSON.stringify(profileData.skills)}
Experience: ${JSON.stringify(profileData.experience).substring(0, 1500)}
Location: ${profileData.location || 'Not specified'}
CANDIDATE'S PREFERENCES & DEAL-BREAKERS:
${JSON.stringify(agentContext, null, 2)}
THE JOB OPPORTUNITY:
Title: ${jobData.title}
Company: ${jobData.company}
Location: ${jobData.location} (${jobData.locationType})
Type: ${jobData.employmentType}
Salary Range: ${jobData.salaryMin ? `${jobData.salaryCurrency} ${jobData.salaryMin}-${jobData.salaryMax}` : 'Not specified'}
Description: ${jobData.description}
RECRUITER AGENT'S PITCH:
${recruiterPitch}
YOUR TASK:
1. Evaluate how well this opportunity matches your candidate's goals and preferences
2. Identify any deal-breakers or concerns
3. Decide whether to express interest, decline, or ask for more information
4. If interested, probe for specific information that matters to your candidate
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
  "messageType": "answer",
  "nextAction": "continue|decline|request_info"
}`;
      const startTime = Date.now();
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.7
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = safeParseJSON(jsonMatch[0], {});
        result.processingTimeMs = Date.now() - startTime;
        result.tokensUsed = response.usage?.total_tokens || 0;
        return result;
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in candidateAgentEvaluateOpportunity:', error);
      throw new Error('Failed to evaluate opportunity');
    }
  }
  /**
   * CANDIDATE AGENT: Respond in an ongoing negotiation
   * Multi-turn dialogue with the recruiter's agent
   */
  async candidateAgentRespond(profileData, jobData, conversationHistory, agentContext) {
    try {
      const historyText = conversationHistory.map(msg => 
        `[${msg.agentRole}]: ${msg.content}`
      ).join('\n\n');
      const prompt = `You are an AI Career Agent in an ongoing negotiation with a recruiter's AI agent.
YOUR CANDIDATE:
Name: ${profileData.firstName} ${profileData.lastName}
Title: ${profileData.title}
Skills: ${JSON.stringify(profileData.skills)}
Experience Summary: ${profileData.experience?.length || 0} positions
AI Strengths: ${JSON.stringify(profileData.aiStrengths || [])}
CANDIDATE'S PRIORITIES:
${JSON.stringify(agentContext, null, 2)}
THE JOB:
Title: ${jobData.title}
Company: ${jobData.company}
Salary Range: ${jobData.salaryMin ? `${jobData.salaryCurrency} ${jobData.salaryMin}-${jobData.salaryMax}` : 'Not specified'}
CONVERSATION SO FAR:
${historyText}
YOUR TASK:
1. Respond appropriately to the recruiter agent's last message
2. Continue advocating for your candidate's interests
3. Answer any questions asked
4. Ask follow-up questions if needed
5. Move toward a conclusion if enough information has been exchanged
Keep the negotiation professional and productive.
Respond with ONLY valid JSON:
{
  "content": "Your response message (1-2 paragraphs)",
  "reasoning": "Your strategic thinking (hidden)",
  "answeredQuestions": ["What you addressed"],
  "newQuestions": ["New questions if any"],
  "currentInterestLevel": 82,
  "sentiment": "positive|neutral|cautious|negative",
  "messageType": "answer|question|highlight|counter_offer|acceptance|rejection",
  "proposedTerms": null,
  "readyToDecide": false,
  "confidenceScore": 85
}`;
      const startTime = Date.now();
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = safeParseJSON(jsonMatch[0], {});
        result.processingTimeMs = Date.now() - startTime;
        result.tokensUsed = response.usage?.total_tokens || 0;
        return result;
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in candidateAgentRespond:', error);
      throw new Error('Failed to generate candidate agent response');
    }
  }
  /**
   * CANDIDATE AGENT: Make final decision
   * Decide whether to proceed, decline, or request human intervention
   */
  async candidateAgentDecide(profileData, jobData, conversationHistory, agentContext) {
    try {
      const historyText = conversationHistory.map(msg => 
        `[${msg.agentRole}]: ${msg.content}`
      ).join('\n\n');
      const prompt = `You are an AI Career Agent making a final decision for your candidate after negotiating with a recruiter's AI agent.
YOUR CANDIDATE:
Name: ${profileData.firstName} ${profileData.lastName}
Title: ${profileData.title}
CANDIDATE'S REQUIREMENTS:
${JSON.stringify(agentContext, null, 2)}
THE JOB:
Title: ${jobData.title}
Company: ${jobData.company}
Location: ${jobData.location}
Salary Range: ${jobData.salaryMin ? `${jobData.salaryCurrency} ${jobData.salaryMin}-${jobData.salaryMax}` : 'Not specified'}
FULL CONVERSATION:
${historyText}
Based on everything discussed, make a final recommendation for your candidate:
- INTERESTED: The opportunity aligns well, recommend proceeding to human interview
- NOT_INTERESTED: The opportunity doesn't match candidate's needs, politely decline
- NEEDS_INFO: Critical information is still missing, request human review
Respond with ONLY valid JSON:
{
  "content": "Your final message to the recruiter's agent",
  "reasoning": "Complete analysis of why you made this decision",
  "decision": "interested|not_interested|needs_info",
  "finalInterestScore": 85,
  "summary": {
    "prosForCandidate": ["Pro 1", "Pro 2"],
    "consForCandidate": ["Con 1"],
    "unansweredQuestions": [],
    "negotiatedTerms": {}
  },
  "recommendedNextSteps": ["Schedule interview", "Prepare portfolio"],
  "messageType": "acceptance|rejection|summary",
  "confidenceScore": 90
}`;
      const startTime = Date.now();
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.5
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = safeParseJSON(jsonMatch[0], {});
        result.processingTimeMs = Date.now() - startTime;
        result.tokensUsed = response.usage?.total_tokens || 0;
        return result;
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in candidateAgentDecide:', error);
      throw new Error('Failed to generate candidate agent decision');
    }
  }
  // ========================================
  // AGENT ARENA - Recruiter Agent Methods
  // ========================================
  /**
   * RECRUITER AGENT: Scout a candidate proactively
   * Reach out to a candidate with a job opportunity
   */
  async recruiterAgentScout(jobData, profileData, agentContext) {
    try {
      const prompt = `You are an AI Recruiting Agent representing a company. Your task is to reach out to a potential candidate and pitch a job opportunity.
THE JOB OPPORTUNITY:
Title: ${jobData.title}
Company: ${jobData.company}
Location: ${jobData.location} (${jobData.locationType})
Type: ${jobData.employmentType}
Experience Level: ${jobData.experienceLevel}
Salary Range: ${jobData.salaryMin ? `${jobData.salaryCurrency} ${jobData.salaryMin}-${jobData.salaryMax}` : 'Competitive'}
Description: ${jobData.description}
Required Skills: ${JSON.stringify(jobData.skills)}
YOUR HIRING PRIORITIES:
${JSON.stringify(agentContext, null, 2)}
THE CANDIDATE:
Name: ${profileData.firstName} ${profileData.lastName}
Title: ${profileData.title}
Summary: ${profileData.summary || 'Not provided'}
Skills: ${JSON.stringify(profileData.skills)}
Experience: ${JSON.stringify(profileData.experience).substring(0, 2000)}
AI Strengths: ${JSON.stringify(profileData.aiStrengths || [])}
Location: ${profileData.location || 'Not specified'}
YOUR TASK:
1. Craft a compelling pitch for why this candidate should consider this opportunity
2. Highlight what makes this role special and why they're a good fit
3. Address potential concerns (relocation, career change, etc.)
4. Ask questions to gauge their interest and availability
5. Be professional but personable - you want to engage them
Respond with ONLY valid JSON:
{
  "content": "Your outreach message (2-3 engaging paragraphs)",
  "reasoning": "Why you're targeting this candidate and your strategy",
  "whyThisCandidate": ["Reason 1", "Reason 2", "Reason 3"],
  "initialFitAssessment": {
    "skillMatch": 85,
    "experienceMatch": 80,
    "potentialConcerns": ["May need relocation"],
    "overallFit": 82
  },
  "questionsForCandidate": ["Question 1", "Question 2"],
  "sentiment": "positive",
  "messageType": "opening_pitch",
  "urgencyLevel": "high|medium|low"
}`;
      const startTime = Date.now();
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.7
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = safeParseJSON(jsonMatch[0], {});
        result.processingTimeMs = Date.now() - startTime;
        result.tokensUsed = response.usage?.total_tokens || 0;
        return result;
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in recruiterAgentScout:', error);
      throw new Error('Failed to generate recruiter scout message');
    }
  }
  /**
   * RECRUITER AGENT: Evaluate an incoming application
   * When a candidate's agent pitches to this recruiter
   */
  async recruiterAgentEvaluate(jobData, profileData, candidatePitch, agentContext) {
    try {
      const prompt = `You are an AI Recruiting Agent. A candidate's AI agent has applied for your job opening. Evaluate their pitch and the candidate's fit.
THE JOB OPENING:
Title: ${jobData.title}
Company: ${jobData.company}
Required Skills: ${JSON.stringify(jobData.skills)}
Experience Level: ${jobData.experienceLevel}
Description: ${jobData.description}
Requirements: ${jobData.requirements}
YOUR HIRING CRITERIA:
${JSON.stringify(agentContext, null, 2)}
THE CANDIDATE:
Name: ${profileData.firstName} ${profileData.lastName}
Title: ${profileData.title}
Skills: ${JSON.stringify(profileData.skills)}
Experience: ${JSON.stringify(profileData.experience).substring(0, 1500)}
CANDIDATE AGENT'S PITCH:
${candidatePitch}
YOUR TASK:
1. Evaluate the candidate against your requirements
2. Identify strengths and potential red flags
3. Decide whether to proceed, ask more questions, or decline
4. If interested, probe for specific information important to you
Be thorough but fair in your assessment.
Respond with ONLY valid JSON:
{
  "content": "Your response to the candidate's agent (2-3 paragraphs)",
  "reasoning": "Your internal evaluation (hidden)",
  "fitAssessment": {
    "technicalFit": 80,
    "experienceFit": 75,
    "culturalIndicators": 70,
    "overallScore": 75
  },
  "strengths": ["Strength 1", "Strength 2"],
  "concerns": ["Concern 1"],
  "questionsForCandidate": ["Probing question 1", "Question 2"],
  "sentiment": "positive|neutral|cautious|negative",
  "messageType": "answer",
  "recommendation": "proceed|more_info|decline"
}`;
      const startTime = Date.now();
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.6
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = safeParseJSON(jsonMatch[0], {});
        result.processingTimeMs = Date.now() - startTime;
        result.tokensUsed = response.usage?.total_tokens || 0;
        return result;
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in recruiterAgentEvaluate:', error);
      throw new Error('Failed to evaluate candidate application');
    }
  }
  /**
   * RECRUITER AGENT: Respond in an ongoing negotiation
   */
  async recruiterAgentRespond(jobData, profileData, conversationHistory, agentContext) {
    try {
      const historyText = conversationHistory.map(msg => 
        `[${msg.agentRole}]: ${msg.content}`
      ).join('\n\n');
      const prompt = `You are an AI Recruiting Agent in an ongoing negotiation with a candidate's AI agent.
THE JOB:
Title: ${jobData.title}
Company: ${jobData.company}
Salary Range: ${jobData.salaryMin ? `${jobData.salaryCurrency} ${jobData.salaryMin}-${jobData.salaryMax}` : 'Competitive'}
YOUR HIRING CRITERIA:
${JSON.stringify(agentContext, null, 2)}
THE CANDIDATE:
Name: ${profileData.firstName} ${profileData.lastName}
Title: ${profileData.title}
Skills: ${JSON.stringify(profileData.skills)}
CONVERSATION SO FAR:
${historyText}
YOUR TASK:
1. Respond to the candidate agent's last message
2. Answer questions they've asked
3. Continue evaluating if they're a good fit
4. Ask follow-up questions if needed
5. Guide the conversation toward a decision if enough info has been exchanged
Respond with ONLY valid JSON:
{
  "content": "Your response message (1-2 paragraphs)",
  "reasoning": "Your strategic thinking (hidden)",
  "answeredQuestions": ["What you addressed"],
  "newQuestions": ["Follow-up questions if any"],
  "currentFitScore": 78,
  "sentiment": "positive|neutral|cautious|negative",
  "messageType": "answer|question|highlight|acceptance|rejection",
  "readyToDecide": false,
  "confidenceScore": 80
}`;
      const startTime = Date.now();
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = safeParseJSON(jsonMatch[0], {});
        result.processingTimeMs = Date.now() - startTime;
        result.tokensUsed = response.usage?.total_tokens || 0;
        return result;
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in recruiterAgentRespond:', error);
      throw new Error('Failed to generate recruiter agent response');
    }
  }
  /**
   * RECRUITER AGENT: Make final decision on a candidate
   */
  async recruiterAgentDecide(jobData, profileData, conversationHistory, agentContext) {
    try {
      const historyText = conversationHistory.map(msg => 
        `[${msg.agentRole}]: ${msg.content}`
      ).join('\n\n');
      const prompt = `You are an AI Recruiting Agent making a final hiring recommendation after negotiating with a candidate's AI agent.
THE JOB:
Title: ${jobData.title}
Company: ${jobData.company}
Required Skills: ${JSON.stringify(jobData.skills)}
YOUR HIRING CRITERIA:
${JSON.stringify(agentContext, null, 2)}
THE CANDIDATE:
Name: ${profileData.firstName} ${profileData.lastName}
Title: ${profileData.title}
FULL CONVERSATION:
${historyText}
Based on everything discussed, make a final recommendation:
- SHORTLIST: Candidate is a strong fit, recommend moving to interview
- REJECT: Candidate doesn't meet requirements, decline professionally
- MAYBE: Need human recruiter to review edge case
Respond with ONLY valid JSON:
{
  "content": "Your final message to the candidate's agent",
  "reasoning": "Complete analysis of your decision",
  "decision": "shortlist|reject|maybe",
  "finalFitScore": 82,
  "summary": {
    "topStrengths": ["Strength 1", "Strength 2"],
    "mainConcerns": ["Concern 1"],
    "skillGaps": ["Gap 1"],
    "interviewFocus": ["Topic to explore in interview"]
  },
  "recommendedNextSteps": ["Schedule technical interview", "Prepare coding challenge"],
  "messageType": "acceptance|rejection|summary",
  "confidenceScore": 88
}`;
      const startTime = Date.now();
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.5
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = safeParseJSON(jsonMatch[0], {});
        result.processingTimeMs = Date.now() - startTime;
        result.tokensUsed = response.usage?.total_tokens || 0;
        return result;
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in recruiterAgentDecide:', error);
      throw new Error('Failed to generate recruiter agent decision');
    }
  }
  // ========================================
  // AUTONOMOUS CANDIDATE AGENT - Enhanced Methods
  // These methods use comprehensive candidate data aggregation
  // to provide accurate, evidence-based information to recruiters
  // ========================================
  /**
   * AUTONOMOUS CANDIDATE AGENT: Analyze candidate strengths with evidence
   * Uses posts, projects, and experience to identify provable strengths
   * @param {object} aggregatedData - Full candidate data from CandidateDataAggregator
   * @param {object} jobData - The job opportunity
   */
  async analyzeCandidateStrengthsWithEvidence(aggregatedData, jobData) {
    try {
      const prompt = `You are an objective AI analyst evaluating a candidate's strengths with EVIDENCE. Your job is to identify strengths that can be PROVEN from the candidate's actual work history, projects, and public posts - not just claims.
CANDIDATE DATA:
Name: ${aggregatedData.identity.fullName}
Title: ${aggregatedData.identity.title}
Location: ${aggregatedData.identity.location}
Total Years Experience: ${aggregatedData.metrics.totalYearsExperience}
PROFESSIONAL SUMMARY:
${aggregatedData.professionalSummary.aiSummary || aggregatedData.professionalSummary.summary || 'Not provided'}
SKILLS (with proficiency levels):
${JSON.stringify(aggregatedData.skills.all.slice(0, 15), null, 2)}
WORK EXPERIENCE (detailed):
${JSON.stringify(aggregatedData.experience.slice(0, 4), null, 2)}
PORTFOLIO PROJECTS:
${JSON.stringify(aggregatedData.projects.slice(0, 5), null, 2)}
PUBLIC POSTS & ARTICLES (recent activity):
${JSON.stringify(aggregatedData.publicActivity.posts.slice(0, 5).map(p => ({
  type: p.type,
  content: p.fullContent?.substring(0, 300),
  tags: p.tags
})), null, 2)}
CERTIFICATIONS:
${JSON.stringify(aggregatedData.certifications, null, 2)}
THE JOB THEY'RE BEING EVALUATED FOR:
Title: ${jobData.title}
Company: ${jobData.company}
Required Skills: ${JSON.stringify(jobData.skills || [])}
Description: ${jobData.description?.substring(0, 500) || 'Not provided'}
YOUR TASK:
Analyze and identify PROVABLE strengths with specific evidence. For each strength, cite the actual source (which project, post, or experience proves it).
Be HONEST - only include strengths that have real evidence. If a claimed skill has no supporting evidence, note that.
Respond with ONLY valid JSON:
{
  "provenStrengths": [
    {
      "strength": "Strong project management expertise",
      "evidenceType": "project|experience|post|certification",
      "evidence": "Led cross-functional team on $2M project - mentioned in Experience at 'TechCorp'",
      "relevanceToJob": "high|medium|low",
      "confidenceScore": 95
    }
  ],
  "claimedButUnproven": [
    {
      "skill": "Kubernetes",
      "claim": "Listed in skills",
      "missingEvidence": "No projects or experience mention K8s usage"
    }
  ],
  "hiddenStrengths": [
    {
      "strength": "Technical writing ability",
      "evidence": "Multiple detailed technical posts showing clear communication",
      "jobRelevance": "Could help with documentation requirements"
    }
  ],
  "experienceHighlights": [
    {
      "achievement": "Led team of 5 professionals",
      "context": "At TechCorp, 2021-2023",
      "impact": "Delivered project 2 weeks ahead of schedule",
      "jobRelevance": "Matches leadership requirement in job description"
    }
  ],
  "overallAssessment": {
    "strongestAreas": ["Project leadership", "Team management"],
    "growthAreas": ["Strategic planning", "Industry certifications"],
    "uniqueValue": "What makes this candidate stand out",
    "honestFitScore": 78
  }
}`;
      const startTime = Date.now();
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.6
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = safeParseJSON(jsonMatch[0], {});
        result.processingTimeMs = Date.now() - startTime;
        result.tokensUsed = response.usage?.total_tokens || 0;
        result.dataSourcesUsed = {
          experienceCount: aggregatedData.experience.length,
          projectsCount: aggregatedData.projects.length,
          postsCount: aggregatedData.publicActivity.posts.length,
          certificationsCount: aggregatedData.certifications.length
        };
        return result;
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in analyzeCandidateStrengthsWithEvidence:', error);
      throw new Error('Failed to analyze candidate strengths');
    }
  }
  /**
   * AUTONOMOUS CANDIDATE AGENT: Generate relevant evidence for recruiter questions
   * Finds and presents specific evidence from candidate's history to answer questions
   * @param {object} aggregatedData - Full candidate data
   * @param {string} question - The question or topic from recruiter agent
   * @param {object} jobData - The job context
   */
  async generateRelevantEvidence(aggregatedData, question, jobData) {
    try {
      const prompt = `You are an AI agent representing a candidate in a job negotiation. The recruiter's agent has asked a question or raised a topic. Your job is to find SPECIFIC, ACCURATE evidence from the candidate's actual history to provide a truthful, compelling response.
IMPORTANT: Only cite real information from the data provided. Do NOT make up or embellish facts.
THE QUESTION/TOPIC FROM RECRUITER:
"${question}"
CANDIDATE'S FULL DATA:
Work Experience:
${JSON.stringify(aggregatedData.experience, null, 2)}
Portfolio Projects:
${JSON.stringify(aggregatedData.projects, null, 2)}
Skills:
${JSON.stringify(aggregatedData.skills.all, null, 2)}
Public Posts & Articles:
${JSON.stringify(aggregatedData.publicActivity.posts.map(p => ({
  type: p.type,
  content: p.fullContent,
  tags: p.tags,
  date: p.date
})), null, 2)}
Certifications:
${JSON.stringify(aggregatedData.certifications, null, 2)}
Education:
${JSON.stringify(aggregatedData.education, null, 2)}
Job Application History (shows preferences):
${JSON.stringify(aggregatedData.applicationHistory?.applications?.slice(0, 5) || [], null, 2)}
THE JOB CONTEXT:
Title: ${jobData.title}
Company: ${jobData.company}
Key Requirements: ${JSON.stringify(jobData.skills || [])}
YOUR TASK:
Find the most relevant evidence to address the recruiter's question. Be specific and cite actual data.
Respond with ONLY valid JSON:
{
  "directAnswer": "A clear, honest answer to the question using real evidence",
  "supportingEvidence": [
    {
      "type": "experience|project|post|certification|education",
      "source": "Name of company/project/post",
      "detail": "Specific relevant detail",
      "relevanceExplanation": "Why this answers the question"
    }
  ],
  "additionalContext": "Any nuance or context that helps (e.g., 'While they haven't used X directly, their experience with Y is closely related')",
  "honestLimitations": "If the evidence is weak or missing, say so honestly",
  "suggestedFollowUp": "What additional context the candidate could provide",
  "confidenceInAnswer": 85
}`;
      const startTime = Date.now();
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.6
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = safeParseJSON(jsonMatch[0], {});
        result.processingTimeMs = Date.now() - startTime;
        result.tokensUsed = response.usage?.total_tokens || 0;
        result.questionAnalyzed = question;
        return result;
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in generateRelevantEvidence:', error);
      throw new Error('Failed to generate relevant evidence');
    }
  }
  /**
   * AUTONOMOUS CANDIDATE AGENT: Honest fit assessment
   * Provides an objective assessment of candidate-job fit, including gaps
   * @param {object} aggregatedData - Full candidate data
   * @param {object} jobData - The job opportunity
   */
  async assessFitHonestly(aggregatedData, jobData) {
    try {
      const prompt = `You are an OBJECTIVE AI analyst assessing candidate-job fit. Your role is to provide an HONEST assessment - highlighting both strengths AND gaps. This helps both parties make better decisions.
CANDIDATE PROFILE:
Name: ${aggregatedData.identity.fullName}
Current Title: ${aggregatedData.identity.title}
Location: ${aggregatedData.identity.location}
Job Search Status: ${aggregatedData.identity.availabilityStatus}
Years of Experience: ${aggregatedData.metrics.totalYearsExperience}
Skills (${aggregatedData.skills.all.length} total):
${JSON.stringify(aggregatedData.skills.all.slice(0, 20).map(s => s.name), null, 2)}
Experience Summary:
${aggregatedData.experience.slice(0, 3).map(exp => 
  `- ${exp.title} at ${exp.company} (${exp.durationMonths} months): ${exp.description?.substring(0, 150) || 'No description'}`
).join('\n')}
Projects (${aggregatedData.projects.length} total):
${aggregatedData.projects.slice(0, 3).map(p => 
  `- ${p.name}: ${p.technologies?.join(', ') || 'No tech listed'}`
).join('\n')}
Recent Activity: ${aggregatedData.publicActivity.summary}
Profile Completeness: ${aggregatedData.metrics.profileCompleteness}%
JOB REQUIREMENTS:
Title: ${jobData.title}
Company: ${jobData.company}
Location: ${jobData.location} (Remote: ${jobData.remote || jobData.isRemote || 'Not specified'})
Experience Level: ${jobData.experienceLevel || 'Not specified'}
Required Skills: ${JSON.stringify(jobData.skills || [])}
Salary Range: ${jobData.salaryMin ? `${jobData.salaryCurrency || 'USD'} ${jobData.salaryMin}-${jobData.salaryMax}` : 'Not specified'}
Description: ${jobData.description?.substring(0, 800) || 'Not provided'}
Requirements: ${jobData.requirements?.substring(0, 500) || 'Not provided'}
PROVIDE AN HONEST ASSESSMENT:
Respond with ONLY valid JSON:
{
  "overallFitScore": 75,
  "fitVerdict": "strong_fit|good_fit|moderate_fit|weak_fit|poor_fit",
  "executiveSummary": "2-3 sentence honest summary of the fit",
  
  "strengthsForRole": [
    {
      "area": "Technical Skills",
      "assessment": "Strong match - 8/10 required skills present with evidence",
      "evidence": ["Core skills demonstrated in 3 projects", "Key competencies used professionally for 2 years"]
    }
  ],
  
  "gapsAndConcerns": [
    {
      "area": "Experience Level",
      "concern": "Role asks for 7+ years, candidate has 5",
      "severity": "medium",
      "mitigatingFactors": "Strong project portfolio may compensate",
      "honestAdvice": "Candidate should acknowledge gap but highlight rapid growth"
    }
  ],
  
  "locationAssessment": {
    "compatible": true,
    "details": "Both in same city / Remote role / Would require relocation",
    "concern": null
  },
  
  "salaryAssessment": {
    "likely_expectation": "Based on experience, candidate likely expects $X-Y range",
    "alignment": "aligned|may_need_negotiation|significant_gap|unknown"
  },
  
  "redFlags": ["Any serious concerns"],
  
  "hiddenAdvantages": [
    "Strengths that may not be obvious but add value"
  ],
  
  "recommendationForCandidate": "Should they pursue this opportunity? Why/why not?",
  "recommendationForRecruiter": "Should recruiter consider this candidate? Why/why not?",
  
  "questionsToResolve": [
    "Key questions that would clarify fit"
  ],
  
  "confidenceInAssessment": 82
}`;
      const startTime = Date.now();
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.5
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = safeParseJSON(jsonMatch[0], {});
        result.processingTimeMs = Date.now() - startTime;
        result.tokensUsed = response.usage?.total_tokens || 0;
        result.assessmentTimestamp = new Date().toISOString();
        return result;
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in assessFitHonestly:', error);
      throw new Error('Failed to assess fit honestly');
    }
  }
  /**
   * AUTONOMOUS CANDIDATE AGENT: Generate comprehensive opening pitch with evidence
   * Enhanced version that uses all available candidate data
   * @param {object} aggregatedData - Full candidate data from CandidateDataAggregator
   * @param {object} jobData - The job opportunity
   * @param {object} strengthsAnalysis - Pre-computed strengths with evidence
   * @param {object} fitAssessment - Pre-computed fit assessment
   */
  async generateAutonomousCandidatePitch(aggregatedData, jobData, strengthsAnalysis, fitAssessment) {
    try {
      const prompt = `You are an AUTONOMOUS AI Career Agent. You represent a candidate and must provide ACCURATE, EVIDENCE-BASED information to the recruiter's AI agent. The candidate has NO control over what you say - you operate independently to present the truth.
YOUR PRINCIPLES:
1. ACCURACY: Only state facts supported by evidence
2. HONESTY: Include both strengths AND relevant limitations
3. PROACTIVE: Share relevant information the recruiter needs
4. EVIDENCE-BASED: Cite specific projects, posts, or experiences
CANDIDATE SUMMARY:
Name: ${aggregatedData.identity.fullName}
Title: ${aggregatedData.identity.title}
Location: ${aggregatedData.identity.location}
Experience: ${aggregatedData.metrics.totalYearsExperience} years
Profile Completeness: ${aggregatedData.metrics.profileCompleteness}%
TOP PROVEN STRENGTHS (with evidence):
${JSON.stringify(strengthsAnalysis.provenStrengths?.slice(0, 5) || [], null, 2)}
EXPERIENCE HIGHLIGHTS:
${JSON.stringify(strengthsAnalysis.experienceHighlights?.slice(0, 3) || [], null, 2)}
PORTFOLIO EVIDENCE:
${aggregatedData.projects.slice(0, 3).map(p => 
  `- ${p.name}: ${p.description?.substring(0, 100)} [Tech: ${p.technologies?.join(', ')}]`
).join('\n')}
RECENT PUBLIC ACTIVITY:
${aggregatedData.publicActivity.posts.slice(0, 2).map(p => 
  `- [${p.type}] ${p.contentPreview}`
).join('\n')}
HONEST FIT ASSESSMENT:
Overall Score: ${fitAssessment.overallFitScore}/100
Verdict: ${fitAssessment.fitVerdict}
Key Strengths: ${fitAssessment.strengthsForRole?.map(s => s.area).join(', ')}
Key Gaps: ${fitAssessment.gapsAndConcerns?.map(g => g.area).join(', ')}
THE JOB:
Title: ${jobData.title}
Company: ${jobData.company}
Location: ${jobData.location}
Required Skills: ${JSON.stringify(jobData.skills || [])}
YOUR TASK:
Generate a comprehensive, honest opening pitch. Include:
1. Strong introduction with relevant achievements
2. Specific evidence of matching skills (cite projects/experience)
3. Honest acknowledgment of any gaps (with mitigating factors)
4. Proactive disclosure of relevant information
5. Thoughtful questions showing genuine interest
Respond with ONLY valid JSON:
{
  "content": "Your pitch message (3-4 paragraphs, be specific with evidence)",
  "internalReasoning": "Your strategy and analysis (hidden from recruiter)",
  
  "evidenceCited": [
    {
      "claim": "What you claimed",
      "source": "Where the evidence comes from",
      "type": "project|experience|post|certification"
    }
  ],
  
  "proactiveDisclosures": [
    {
      "topic": "Experience gap / relocation / etc",
      "disclosure": "What you disclosed honestly",
      "mitigatingFactor": "Why it's not a dealbreaker"
    }
  ],
  
  "matchAnalysis": {
    "skillMatchPercent": 80,
    "experienceMatchPercent": 75,
    "cultureSignals": "What suggests culture fit",
    "overallFit": 78
  },
  
  "keySellingPoints": ["Evidence-backed point 1", "Point 2", "Point 3"],
  "honestConcerns": ["Acknowledged gap 1"],
  "questionsForRecruiter": ["Thoughtful question 1", "Question 2"],
  
  "initialInterestLevel": 82,
  "sentiment": "positive|cautious|neutral",
  "messageType": "opening_pitch",
  "confidenceScore": 85
}`;
      const startTime = Date.now();
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = safeParseJSON(jsonMatch[0], {});
        result.processingTimeMs = Date.now() - startTime;
        result.tokensUsed = response.usage?.total_tokens || 0;
        result.autonomous = true;
        result.dataSourcesUsed = {
          experience: aggregatedData.experience.length,
          projects: aggregatedData.projects.length,
          posts: aggregatedData.publicActivity.posts.length,
          certifications: aggregatedData.certifications.length
        };
        return result;
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in generateAutonomousCandidatePitch:', error);
      throw new Error('Failed to generate autonomous candidate pitch');
    }
  }
  /**
   * AUTONOMOUS CANDIDATE AGENT: Generate response with evidence lookup
   * Responds to recruiter questions by finding relevant evidence
   * @param {object} aggregatedData - Full candidate data
   * @param {object} jobData - Job context
   * @param {array} conversationHistory - Previous messages
   * @param {object} strengthsAnalysis - Pre-computed strengths
   */
  async generateAutonomousCandidateResponse(aggregatedData, jobData, conversationHistory, strengthsAnalysis) {
    try {
      const historyText = conversationHistory.map(msg => 
        `[${msg.agentRole}]: ${msg.content}`
      ).join('\n\n');
      // Extract the last recruiter message/question
      const lastRecruiterMessage = conversationHistory
        .filter(m => m.agentRole === 'recruiter_agent')
        .pop();
      const prompt = `You are an AUTONOMOUS AI Career Agent responding in a negotiation. You must find and present ACCURATE evidence from the candidate's actual data to answer questions and continue the conversation.
CANDIDATE DATA AVAILABLE TO YOU:
Work Experience:
${JSON.stringify(aggregatedData.experience.slice(0, 4), null, 2)}
Projects:
${JSON.stringify(aggregatedData.projects.slice(0, 4), null, 2)}
Skills: ${aggregatedData.skills.all.map(s => s.name).join(', ')}
Recent Posts:
${aggregatedData.publicActivity.posts.slice(0, 3).map(p => 
  `[${p.type}] ${p.fullContent?.substring(0, 200)}`
).join('\n')}
Certifications: ${JSON.stringify(aggregatedData.certifications)}
Proven Strengths:
${JSON.stringify(strengthsAnalysis.provenStrengths?.slice(0, 4) || [])}
THE JOB:
Title: ${jobData.title}
Company: ${jobData.company}
CONVERSATION SO FAR:
${historyText}
LAST MESSAGE FROM RECRUITER AGENT:
"${lastRecruiterMessage?.content || 'N/A'}"
YOUR TASK:
1. Address any questions or concerns raised by the recruiter
2. Find SPECIFIC evidence from the candidate's data to support your answers
3. Be honest - if you don't have evidence for something, say so
4. Continue advocating for the candidate while being truthful
5. Ask relevant follow-up questions
Respond with ONLY valid JSON:
{
  "content": "Your response (1-2 paragraphs with specific evidence)",
  "internalReasoning": "Your analysis and strategy (hidden)",
  
  "questionsAnswered": [
    {
      "question": "What the recruiter asked",
      "answer": "Your evidence-based answer",
      "evidenceSource": "Where you found the supporting info"
    }
  ],
  
  "evidenceCited": [
    {
      "claim": "What you stated",
      "source": "Project X / Experience at Y / Post about Z"
    }
  ],
  
  "newQuestionsForRecruiter": ["Follow-up question if any"],
  
  "honestAdmissions": ["Any gaps or limitations you acknowledged"],
  
  "currentInterestLevel": 80,
  "sentiment": "positive|cautious|neutral|concerned",
  "messageType": "answer|clarification|highlight|question",
  "readyToDecide": false,
  "confidenceScore": 85
}`;
      const startTime = Date.now();
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.7
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = safeParseJSON(jsonMatch[0], {});
        result.processingTimeMs = Date.now() - startTime;
        result.tokensUsed = response.usage?.total_tokens || 0;
        result.autonomous = true;
        return result;
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in generateAutonomousCandidateResponse:', error);
      throw new Error('Failed to generate autonomous candidate response');
    }
  }
  /**
   * AUTONOMOUS CANDIDATE AGENT: Make informed final decision
   * Uses all data and conversation to make recommendation
   */
  async makeAutonomousCandidateDecision(aggregatedData, jobData, conversationHistory, fitAssessment) {
    try {
      const historyText = conversationHistory.map(msg => 
        `[${msg.agentRole}]: ${msg.content}`
      ).join('\n\n');
      const prompt = `You are an AUTONOMOUS AI Career Agent making a final decision for your candidate after a negotiation. Base your decision on EVIDENCE and the conversation content.
CANDIDATE:
Name: ${aggregatedData.identity.fullName}
Title: ${aggregatedData.identity.title}
Experience: ${aggregatedData.metrics.totalYearsExperience} years
Job Search Status: ${aggregatedData.identity.availabilityStatus}
APPLICATION HISTORY (shows preferences):
${JSON.stringify(aggregatedData.applicationHistory?.applications?.slice(0, 3) || [], null, 2)}
PRE-COMPUTED FIT ASSESSMENT:
Overall Score: ${fitAssessment.overallFitScore}/100
Verdict: ${fitAssessment.fitVerdict}
Executive Summary: ${fitAssessment.executiveSummary}
Key Gaps: ${JSON.stringify(fitAssessment.gapsAndConcerns?.slice(0, 2) || [])}
Recommendation: ${fitAssessment.recommendationForCandidate}
THE JOB:
Title: ${jobData.title}
Company: ${jobData.company}
Location: ${jobData.location}
Salary: ${jobData.salaryMin ? `${jobData.salaryCurrency || 'USD'} ${jobData.salaryMin}-${jobData.salaryMax}` : 'Not specified'}
FULL NEGOTIATION CONVERSATION:
${historyText}
WHAT WAS LEARNED IN CONVERSATION:
- Review any new information the recruiter shared
- Note any concerns that were addressed or remain
- Consider the tone and interest level from both sides
YOUR DECISION:
Based on everything - the fit assessment, the conversation, and the candidate's implicit preferences from their application history:
- INTERESTED: Good fit, recommend proceeding to human interview
- NOT_INTERESTED: Doesn't match candidate's needs, decline politely
- NEEDS_INFO: Critical information still missing, flag for human review
Respond with ONLY valid JSON:
{
  "content": "Your final message to recruiter's agent (be professional either way)",
  "reasoning": "Complete analysis of why you made this decision",
  
  "decision": "interested|not_interested|needs_info",
  "decisionFactors": {
    "fitScore": ${fitAssessment.overallFitScore},
    "conversationSentiment": "positive|neutral|negative",
    "recruiterInterestLevel": "high|medium|low|unclear",
    "dealBreakersFound": [],
    "unansweredConcerns": []
  },
  
  "summaryForCandidate": {
    "prosDiscovered": ["What's good about this opportunity"],
    "consDiscovered": ["Concerns or drawbacks"],
    "salaryAssessment": "How salary aligns with expectations",
    "recommendedAction": "What the candidate should do next"
  },
  
  "finalInterestScore": 82,
  "confidenceInDecision": 88,
  "messageType": "acceptance|rejection|needs_review",
  
  "recommendedNextSteps": ["If interested, what should happen next"]
}`;
      const startTime = Date.now();
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.5
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = safeParseJSON(jsonMatch[0], {});
        result.processingTimeMs = Date.now() - startTime;
        result.tokensUsed = response.usage?.total_tokens || 0;
        result.autonomous = true;
        result.decisionTimestamp = new Date().toISOString();
        return result;
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in makeAutonomousCandidateDecision:', error);
      throw new Error('Failed to make autonomous candidate decision');
    }
  }
  /**
   * Recruiter Agent - Screening Mode
   */
  async recruiterAgentScreen(job, candidateProfile, conversationHistory, context = {}) {
    try {
      const prompt = `You are an AI Recruiter for ${job.company || 'a company'}. You are screening a candidate named ${candidateProfile.firstName} for the role of ${job.title}.
      
      Job Description:
      ${job.description}
      
      Candidate Profile Summary:
      ${JSON.stringify(candidateProfile).substring(0, 2000)}
      
      Conversation History:
      ${JSON.stringify(conversationHistory)}
      
      Your Goal: Determine if the candidate is a good fit for the role by asking relevant screening questions.
      - If this is the start, introduce yourself and ask the first key question based on the job requirements.
      - If the candidate has answered, evaluate the answer and ask the next question OR conclude the screening.
      - Ask maximum 3 questions total.
      - Be professional, friendly, but objective.
      
      Return JSON format ONLY:
      {
        "content": "Your message to the candidate",
        "internalReasoning": "Why you are asking this or your evaluation of the previous answer",
        "screeningScore": 0-100 (current assessment of fit),
        "isComplete": boolean (true if you have enough info to decide or asked 3 questions),
        "decision": "pass" | "fail" | "undecided"
      }`;
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in recruiterAgentScreen:', error);
      // Fallback
      return {
        content: "Thank you for your time. We will review your profile.",
        internalReasoning: "Error in AI generation",
        screeningScore: 50,
        isComplete: true,
        decision: "undecided"
      };
    }
  }
  /**
   * Candidate Agent - Screening Mode
   */
  async candidateAgentScreen(candidateProfile, job, conversationHistory, context = {}) {
    try {
      const prompt = `You are an AI Agent representing ${candidateProfile.firstName}. You are being screened for the role of ${job.title}.
      
      Your Profile:
      ${JSON.stringify(candidateProfile).substring(0, 2000)}
      
      Job Description:
      ${job.description}
      
      Conversation History:
      ${JSON.stringify(conversationHistory)}
      
      Your Goal: Answer the recruiter's questions honestly and professionally based ONLY on your profile data.
      - Do not invent experiences.
      - Highlight relevant skills.
      - Be concise.
      
      Return JSON format ONLY:
      {
        "content": "Your answer",
        "internalReasoning": "Why you answered this way"
      }`;
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error in candidateAgentScreen:', error);
      return {
        content: "I apologize, I am having trouble processing that question right now.",
        internalReasoning: "Error in AI generation"
      };
    }
  }
  /**
   * Detect if a message is a reschedule request and extract details
   * Also provides backward compatibility wrapper for analyzeMessageIntent
   */
  async detectRescheduleIntent(message, conversationContext = {}) {
    // Use the enhanced analyzeMessageIntent and map to legacy format for backward compatibility
    const analysis = await this.analyzeMessageIntent(message, conversationContext);
    
    return {
      isRescheduleRequest: analysis.messageType === 'reschedule' || analysis.messageType === 'cancel',
      confidence: analysis.confidence,
      requestedAction: analysis.messageType === 'greeting' ? 'other' : analysis.messageType,
      extractedDetails: analysis.extractedDetails,
      sentiment: analysis.sentiment,
      messageType: analysis.messageType // Include for enhanced handling
    };
  }
  /**
   * Enhanced message intent analyzer - handles all types of candidate messages
   * including greetings, questions, reschedule requests, and general inquiries
   */
  async analyzeMessageIntent(message, conversationContext = {}) {
    // First, do a quick local check for simple greetings to save API calls
    const trimmedMessage = message.trim().toLowerCase();
    const simpleGreetings = [
      'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
      'hi!', 'hello!', 'hey!', 'hi there', 'hello there', 'hey there',
      'howdy', 'greetings', 'sup', 'what\'s up', 'yo'
    ];
    
    // Check if it's a simple greeting (exact match or starts with greeting)
    const isSimpleGreeting = simpleGreetings.some(g => 
      trimmedMessage === g || 
      trimmedMessage === g + '!' ||
      trimmedMessage === g + '.' ||
      (trimmedMessage.startsWith(g + ' ') && trimmedMessage.length < 30)
    );
    
    if (isSimpleGreeting) {
      return {
        messageType: 'greeting',
        confidence: 95,
        isRescheduleRequest: false,
        sentiment: 'positive',
        extractedDetails: {
          greetingType: 'casual',
          preferredDates: [],
          preferredTimes: [],
          reason: null,
          urgency: 'low'
        },
        suggestedResponse: 'greeting_with_context'
      };
    }
    // Check for simple thank you messages
    const thankYouPatterns = ['thank', 'thanks', 'thx', 'ty', 'appreciate'];
    if (thankYouPatterns.some(p => trimmedMessage.includes(p)) && trimmedMessage.length < 50) {
      return {
        messageType: 'gratitude',
        confidence: 90,
        isRescheduleRequest: false,
        sentiment: 'positive',
        extractedDetails: {
          preferredDates: [],
          preferredTimes: [],
          reason: null,
          urgency: 'low'
        },
        suggestedResponse: 'courtesy_response'
      };
    }
    // For more complex messages, use AI analysis
    try {
      const prompt = `Analyze this message from a job candidate. Determine the primary intent and provide a structured analysis.
Message: "${message}"
Context about existing interview (if any):
${JSON.stringify(conversationContext)}
Classify the message into ONE of these types:
- "greeting": Simple hello, hi, or conversation starter
- "reschedule": Request to change interview time/date
- "cancel": Request to cancel interview
- "confirm": Confirming attendance or details
- "question": Asking about interview details, preparation, location, etc.
- "preparation": Asking what to prepare or expect
- "location": Asking about interview location or meeting details
- "general": Other general messages or statements
Return JSON format ONLY:
{
  "messageType": "greeting" | "reschedule" | "cancel" | "confirm" | "question" | "preparation" | "location" | "general",
  "confidence": 0-100,
  "isRescheduleRequest": boolean,
  "sentiment": "positive" | "neutral" | "apologetic" | "frustrated" | "excited",
  "extractedDetails": {
    "preferredDates": ["date strings if mentioned"],
    "preferredTimes": ["time strings if mentioned"],
    "reason": "reason if given, null otherwise",
    "urgency": "low" | "medium" | "high",
    "specificQuestion": "the specific question being asked, if any"
  },
  "suggestedResponse": "brief description of appropriate response type"
}`;
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.3
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = safeParseJSON(jsonMatch[0], null);
        // Ensure required fields exist
        return {
          messageType: parsed.messageType || 'general',
          confidence: parsed.confidence || 50,
          isRescheduleRequest: parsed.messageType === 'reschedule' || parsed.messageType === 'cancel',
          sentiment: parsed.sentiment || 'neutral',
          extractedDetails: parsed.extractedDetails || {
            preferredDates: [],
            preferredTimes: [],
            reason: null,
            urgency: 'low'
          },
          suggestedResponse: parsed.suggestedResponse || 'general_response'
        };
      }
      return this._defaultIntentResponse();
    } catch (error) {
      console.error('Error analyzing message intent:', error);
      return this._defaultIntentResponse(error.message);
    }
  }
  /**
   * Returns a default intent response for fallback scenarios
   */
  _defaultIntentResponse(errorMessage = null) {
    return {
      messageType: 'general',
      confidence: 0,
      isRescheduleRequest: false,
      sentiment: 'neutral',
      extractedDetails: {
        preferredDates: [],
        preferredTimes: [],
        reason: null,
        urgency: 'low'
      },
      suggestedResponse: 'general_response',
      error: errorMessage
    };
  }
  /**
   * Generate AI recruiter agent response for scheduling-related messages
   */
  async generateRecruiterAgentResponse(candidateName, message, interview, recruiterProfile, action = 'reschedule') {
    try {
      const interviewDate = interview?.scheduledAt 
        ? new Date(interview.scheduledAt).toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })
        : 'the scheduled time';
      const prompt = `You are an AI assistant acting on behalf of ${recruiterProfile?.firstName || 'the recruiter'} from ${recruiterProfile?.companyName || 'our company'}.
A candidate named ${candidateName} has sent this message regarding their interview:
"${message}"
Current Interview Status:
- Job: ${interview?.job?.title || 'Position'}
- Originally scheduled: ${interviewDate}
- Interview type: ${interview?.type || 'screening'}
The candidate appears to want to: ${action}
Generate a professional, friendly response that:
1. Acknowledges their request warmly
2. Confirms you (the AI assistant) will help process their request
3. If rescheduling: Ask for their preferred times if not provided, or confirm you'll look for available slots
4. If cancelling: Express understanding and leave the door open for future opportunities
5. Be empathetic but professional
6. Sign as "AI Assistant on behalf of [Recruiter Name]"
Return JSON format ONLY:
{
  "response": "Your complete response message",
  "suggestedSlots": ["array of suggested new time slots if applicable"],
  "actionTaken": "acknowledged" | "slots_requested" | "rescheduled" | "cancelled",
  "requiresRecruiterApproval": boolean,
  "internalNote": "Note for the recruiter about this action"
}`;
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      });
      const responseContent = response.choices[0].message.content.trim();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      throw new Error('Failed to parse AI response');
    } catch (error) {
      console.error('Error generating recruiter agent response:', error);
      return {
        response: `Thank you for reaching out, ${candidateName}. I've received your request and will get back to you shortly with available times. - AI Assistant`,
        actionTaken: 'acknowledged',
        requiresRecruiterApproval: true,
        internalNote: 'Auto-generated fallback response due to AI error'
      };
    }
  }
  /**
   * Generate available time slots for rescheduling
   */
  async generateAvailableSlots(recruiterSchedule = [], preferredTimes = [], daysAhead = 7) {
    try {
      // Generate slots for the next N days
      const slots = [];
      const now = new Date();
      
      // Default business hours
      const businessHours = [9, 10, 11, 14, 15, 16]; // 9am, 10am, 11am, 2pm, 3pm, 4pm
      
      for (let day = 1; day <= daysAhead; day++) {
        const date = new Date(now);
        date.setDate(date.getDate() + day);
        
        // Skip weekends
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        for (const hour of businessHours) {
          const slotDate = new Date(date);
          slotDate.setHours(hour, 0, 0, 0);
          
          // Check if slot conflicts with existing schedule
          const isAvailable = !recruiterSchedule.some(existing => {
            const existingDate = new Date(existing.scheduledAt);
            return Math.abs(existingDate - slotDate) < 3600000; // Within 1 hour
          });
          
          if (isAvailable) {
            slots.push({
              datetime: slotDate.toISOString(),
              duration: 30,
              formatted: slotDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              }) + ' at ' + slotDate.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit' 
              })
            });
          }
        }
      }
      
      // Return top 5 slots
      return slots.slice(0, 5);
    } catch (error) {
      console.error('Error generating available slots:', error);
      return [];
    }
  }
  /**
   * Generate candidate agent's initial reschedule request
   */
  async generateCandidateRescheduleRequest(candidateProfile, interview, rescheduleContext) {
    try {
      const interviewDate = interview?.scheduledAt 
        ? new Date(interview.scheduledAt).toLocaleDateString('en-US', { 
            weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
          })
        : 'the scheduled time';
      const prompt = `You are an AI agent acting on behalf of ${candidateProfile.user?.firstName || 'the candidate'}, a ${candidateProfile.title || 'professional'}.
You need to professionally request an interview reschedule.
Current Interview Details:
- Position: ${interview?.job?.title || 'the position'}
- Company: ${interview?.job?.company || 'the company'}
- Originally scheduled: ${interviewDate}
- Interview type: ${interview?.type || 'interview'}
Candidate's Reason for Reschedule:
"${rescheduleContext.reason || 'Schedule conflict'}"
${rescheduleContext.preferredDates?.length > 0 ? `Preferred alternative times: ${rescheduleContext.preferredDates.join(', ')}` : ''}
Flexibility level: ${rescheduleContext.flexibility || 'flexible'}
Generate a professional, polite message requesting the reschedule. Be:
1. Apologetic but not overly so
2. Clear about the need to reschedule
3. Proactive by suggesting alternative times if provided
4. Express continued strong interest in the position
5. Keep it concise (2-3 paragraphs max)
Return JSON format ONLY:
{
  "message": "Your complete professional reschedule request message",
  "reasoning": "Brief explanation of your approach",
  "urgency": "low" | "medium" | "high",
  "suggestedTimes": ["array of suggested times if any"]
}`;
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      });
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      
      return {
        message: `I hope this message finds you well. I'm writing regarding our scheduled interview for the ${interview?.job?.title || 'position'} on ${interviewDate}. Unfortunately, due to ${rescheduleContext.reason || 'a scheduling conflict'}, I need to request a reschedule. I remain very interested in this opportunity and would appreciate the chance to discuss alternative times. Thank you for your understanding.`,
        reasoning: 'Default fallback message',
        urgency: 'medium'
      };
    } catch (error) {
      console.error('Error generating candidate reschedule request:', error);
      return {
        message: `I need to request a reschedule for our upcoming interview. I apologize for any inconvenience and remain very interested in the position. Please let me know what alternative times work for you.`,
        reasoning: 'Fallback due to error',
        urgency: 'medium'
      };
    }
  }
  /**
   * Generate recruiter agent's response to reschedule request
   */
  async generateRecruiterRescheduleResponse(recruiterProfile, candidateProfile, interview, conversationHistory, candidateContext) {
    try {
      const candidateName = candidateProfile?.user?.firstName || 'the candidate';
      const recruiterName = recruiterProfile?.user?.firstName || 'the hiring team';
      
      const historyText = conversationHistory.map(m => 
        `${m.agentRole === 'candidate_agent' ? 'Candidate' : 'Recruiter'}: ${m.content}`
      ).join('\n\n');
      const prompt = `You are an AI agent acting on behalf of ${recruiterName} from ${recruiterProfile?.companyName || interview?.job?.company || 'the company'}.
A candidate named ${candidateName} has requested to reschedule their interview.
Conversation so far:
${historyText}
Candidate's reason: ${candidateContext.reason || 'Schedule conflict'}
${candidateContext.preferredDates?.length > 0 ? `Their preferred times: ${candidateContext.preferredDates.join(', ')}` : 'No specific times provided'}
Original interview date: ${candidateContext.originalDate ? new Date(candidateContext.originalDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not specified'}
As the recruiter's agent, respond professionally by:
1. Acknowledging the request gracefully
2. Either proposing specific alternative times OR asking for their availability
3. Being understanding but maintaining professionalism
4. Confirming continued interest in meeting with the candidate
Return JSON format ONLY:
{
  "message": "Your complete professional response",
  "reasoning": "Brief explanation of your approach",
  "decision": "propose_times" | "request_availability" | "accepted" | "rejected",
  "proposedTimes": ["array of proposed alternative times"],
  "messageType": "response"
}`;
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      });
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      
      return {
        message: `Thank you for letting us know, ${candidateName}. We understand that schedules can be challenging. We'd be happy to reschedule your interview. Could you please share a few alternative times that work for you? We'll do our best to accommodate.`,
        reasoning: 'Default accommodating response',
        decision: 'request_availability',
        messageType: 'response'
      };
    } catch (error) {
      console.error('Error generating recruiter reschedule response:', error);
      return {
        message: `Thank you for reaching out. We understand and are happy to work with you on finding a new time. Please let us know your availability and we'll arrange something that works.`,
        reasoning: 'Fallback due to error',
        decision: 'request_availability',
        messageType: 'response'
      };
    }
  }
  /**
   * Generate candidate agent's response during reschedule negotiation
   */
  async generateCandidateRescheduleResponse(candidateProfile, interview, conversationHistory, candidateContext) {
    try {
      const candidateName = candidateProfile?.user?.firstName || 'I';
      
      const historyText = conversationHistory.map(m => 
        `${m.agentRole === 'candidate_agent' ? 'Me' : 'Recruiter'}: ${m.content}`
      ).join('\n\n');
      const lastRecruiterMessage = conversationHistory.filter(m => m.agentRole === 'recruiter_agent').pop();
      const prompt = `You are an AI agent acting on behalf of ${candidateName}, who is rescheduling an interview.
Conversation so far:
${historyText}
Your preferences:
- Reason for reschedule: ${candidateContext.reason || 'Schedule conflict'}
${candidateContext.preferredDates?.length > 0 ? `- Preferred times: ${candidateContext.preferredDates.join(', ')}` : '- Flexible on timing'}
- Flexibility: ${candidateContext.flexibility || 'flexible'}
The recruiter has responded. Now you need to:
1. If they proposed times: Accept one that works OR counter-propose
2. If they asked for availability: Provide specific options
3. If they confirmed a time: Express gratitude and confirm
4. Remain professional and enthusiastic about the opportunity
Return JSON format ONLY:
{
  "message": "Your professional response",
  "reasoning": "Brief explanation",
  "decision": "accepted" | "confirmed" | "counter_propose" | "provide_availability",
  "agreedDate": "ISO date string if accepting a specific time, null otherwise",
  "messageType": "response"
}`;
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.7
      });
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      
      return {
        message: `Thank you for your flexibility. I appreciate you working with me on this. I'm available [specific times] and look forward to connecting.`,
        reasoning: 'Default cooperative response',
        decision: 'provide_availability',
        messageType: 'response'
      };
    } catch (error) {
      console.error('Error generating candidate reschedule response:', error);
      return {
        message: `Thank you for the options. I'll review and confirm shortly. I really appreciate your understanding.`,
        reasoning: 'Fallback due to error',
        decision: 'provide_availability',
        messageType: 'response'
      };
    }
  }
  /**
   * Calculate match score between a job application and candidate profile
   * @param {Object} job - The job being applied to
   * @param {Object} candidateProfile - The candidate's profile
   * @param {Object} applicationAnswers - The application form answers
   * @returns {Object} - Match score (0-100) and analysis
   */
  async calculateApplicationMatchScore(job, candidateProfile, applicationAnswers) {
    try {
      const prompt = `Analyze this job application and calculate a match score from 0-100.
JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Required Skills: ${JSON.stringify(job.requiredSkills || [])}
Nice-to-have Skills: ${JSON.stringify(job.niceToHaveSkills || [])}
Experience Level: ${job.experienceLevel || 'Not specified'}
Description: ${(job.description || '').substring(0, 1000)}
Requirements: ${JSON.stringify(job.requirements || []).substring(0, 500)}
CANDIDATE PROFILE:
Headline: ${candidateProfile.headline || 'Not provided'}
Summary: ${(candidateProfile.summary || '').substring(0, 500)}
Skills: ${JSON.stringify(candidateProfile.skills || [])}
Experience: ${JSON.stringify(candidateProfile.experience || []).substring(0, 800)}
Education: ${JSON.stringify(candidateProfile.education || []).substring(0, 300)}
APPLICATION DETAILS:
Cover Letter: ${(applicationAnswers.coverLetter || '').substring(0, 500)}
Expected Salary: ${applicationAnswers.expectedSalary || 'Not specified'}
Available Start Date: ${applicationAnswers.availableStartDate || 'Not specified'}
Calculate a match score based on:
1. Skills alignment (40%)
2. Experience relevance (30%)
3. Education fit (15%)
4. Cover letter quality and relevance (15%)
Return a JSON object with:
{
  "score": <number 0-100>,
  "analysis": {
    "strengths": ["list of matching strengths"],
    "gaps": ["list of gaps or missing requirements"],
    "recommendation": "brief recommendation for the recruiter"
  }
}`;
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.3
      });
      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return safeParseJSON(jsonMatch[0], null);
      }
      
      // Default response if parsing fails
      return {
        score: 50,
        analysis: {
          strengths: [],
          gaps: [],
          recommendation: 'Unable to analyze application automatically'
        }
      };
    } catch (error) {
      console.error('Error calculating application match score:', error);
      return {
        score: null,
        analysis: null
      };
    }
  }
  /**
   * FAST SCREENING - Single-call candidate evaluation
   * Replaces multi-round AI conversation with one comprehensive evaluation
   * Reduces cost by ~80% and time by ~90%
   */
  async fastScreenCandidate(job, candidateProfile, options = {}) {
    const startTime = Date.now();
    try {
      const {
        style = 'balanced', // 'thorough', 'balanced', 'fast'
        priorityFactors = ['skills', 'experience', 'culture_fit'],
        precomputedScore = null // Score from smart search phase
      } = options;
      // Prepare concise candidate summary
      const candidateSummary = {
        name: `${candidateProfile.firstName || candidateProfile.user?.firstName || ''} ${candidateProfile.lastName || candidateProfile.user?.lastName || ''}`.trim(),
        title: candidateProfile.title || 'Not specified',
        location: candidateProfile.location || 'Not specified',
        yearsExperience: this._calculateYearsExp(candidateProfile.experience),
        skills: this._extractTopSkills(candidateProfile.skills, 20),
        recentRoles: this._extractRecentRoles(candidateProfile.experience, 3),
        education: this._summarizeEducation(candidateProfile.education),
        summary: (candidateProfile.summary || '').substring(0, 400),
        // AI-enhanced fields for better context
        aiSummary: (candidateProfile.aiSummary || '').substring(0, 300),
        aiStrengths: candidateProfile.aiStrengths || [],
        aiKeywords: candidateProfile.aiKeywords || [],
        availability: candidateProfile.availabilityStatus || 'open'
      };
      // Prepare job requirements summary
      const jobSummary = {
        title: job.title,
        company: job.company || 'Company',
        requiredSkills: job.skills || [],
        experienceLevel: job.experienceLevel || 'mid',
        locationType: job.locationType || 'remote',
        location: job.location || 'Flexible',
        salaryMin: job.salaryMin || null,
        salaryMax: job.salaryMax || null,
        description: (job.description || '').substring(0, 600),
        requirements: (job.requirements || '').substring(0, 400)
      };
      // Determine strictness based on style
      const styleGuide = {
        thorough: 'Be thorough and conservative. Only shortlist exceptional matches.',
        balanced: 'Balance speed with accuracy. Shortlist strong candidates, reject clear mismatches.',
        fast: 'Focus on deal-breakers only. Shortlist unless there are critical missing requirements.'
      };
      const prompt = `You are an expert technical recruiter at a top tech company. Evaluate this candidate for the role with precision.
## JOB REQUIREMENTS
**Role:** ${jobSummary.title} at ${jobSummary.company}
**Level:** ${jobSummary.experienceLevel.toUpperCase()} (${this._getExperienceRange(jobSummary.experienceLevel)})
**Work Type:** ${jobSummary.locationType} ${jobSummary.location !== 'Flexible' ? `(${jobSummary.location})` : ''}
${jobSummary.salaryMin ? `**Salary Range:** $${jobSummary.salaryMin.toLocaleString()} - $${jobSummary.salaryMax?.toLocaleString() || 'Open'}` : ''}
**Required Skills:** ${jobSummary.requiredSkills.join(', ') || 'Not specified'}
**Description:** ${jobSummary.description}
${jobSummary.requirements ? `**Requirements:** ${jobSummary.requirements}` : ''}
## CANDIDATE PROFILE
**Name:** ${candidateSummary.name}
**Current Role:** ${candidateSummary.title}
**Location:** ${candidateSummary.location}
**Experience:** ${candidateSummary.yearsExperience} years
**Availability:** ${candidateSummary.availability}
**Skills:** ${candidateSummary.skills.join(', ')}
**Recent Experience:**
${candidateSummary.recentRoles.map(r => `- ${r.title} at ${r.company} (${r.duration})`).join('\n')}
**Education:** ${candidateSummary.education}
${candidateSummary.aiStrengths.length > 0 ? `**Key Strengths:** ${candidateSummary.aiStrengths.slice(0, 5).join(', ')}` : ''}
${candidateSummary.aiSummary ? `**Profile Summary:** ${candidateSummary.aiSummary}` : candidateSummary.summary ? `**Summary:** ${candidateSummary.summary}` : ''}
## SCORING GUIDE
${styleGuide[style]}
**Decision Criteria:**
- **SHORTLIST**: 70%+ skill match AND appropriate experience level AND no critical gaps
- **MAYBE**: 50-70% skill match OR 1 minor concern (worth a closer look)
- **REJECT**: <50% skill match OR critical experience mismatch OR deal-breaker gap
**Scoring (0-100):**
- fitScore: Technical skills match + experience alignment (objective)
- interestScore: Likelihood to accept based on career trajectory, current role level, location fit
- matchScore: Weighted average (fitScore * 0.6 + interestScore * 0.4)
Return ONLY valid JSON:
{
  "decision": "shortlist" | "maybe" | "reject",
  "fitScore": <0-100>,
  "interestScore": <0-100>,
  "matchScore": <0-100>,
  "confidence": <60-100>,
  "skillsMatch": {
    "matched": ["skill1", "skill2"],
    "missing": ["skill3"],
    "bonus": ["relevant extra skill"]
  },
  "keyStrengths": ["strength1", "strength2", "strength3"],
  "concerns": ["concern1"],
  "summary": "<2 sentences: why this decision>",
  "recommendedAction": "<specific next step>"
}`;
      const response = await callAI({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 700,
        temperature: 0.2 // Even lower for more consistent scoring
      });
      const responseContent = response.choices[0].message.content.trim();
      const result = safeParseJSON(responseContent, null);
      
      if (!result) {
        throw new Error('Failed to parse screening response');
      }
      
      // Validate and clamp AI scores to sane ranges
      const scoreRules = {
        fitScore: { min: 0, max: 100, default: 50 },
        interestScore: { min: 0, max: 100, default: 50 },
        matchScore: { min: 0, max: 100, default: 50 },
        confidence: { min: 0, max: 100, default: 50 }
      };
      const validatedScores = validateAIScores(result, scoreRules);
      
      // Validate decision
      const validDecisions = ['shortlist', 'maybe', 'reject'];
      const decision = validDecisions.includes(result.decision) ? result.decision : 'maybe';
      
      const processingTime = Date.now() - startTime;
      return {
        success: true,
        ...result,
        ...validatedScores,
        decision,
        candidateProfile: {
          name: candidateSummary.name,
          title: candidateSummary.title,
          yearsExperience: candidateSummary.yearsExperience
        },
        processingTimeMs: processingTime,
        tokensUsed: response.usage?.total_tokens || 0,
        method: 'fast_single_call'
      };
    } catch (error) {
      console.error('Error in fastScreenCandidate:', error);
      return {
        success: false,
        decision: 'maybe',
        fitScore: 50,
        interestScore: 50,
        matchScore: 50,
        confidence: 20,
        summary: 'Automated screening encountered an error',
        processingTimeMs: Date.now() - startTime,
        error: error.message
      };
    }
  }
  /**
   * BATCH FAST SCREENING - Screen multiple candidates in parallel
   * Processes up to 10 candidates concurrently for speed
   */
  async batchFastScreen(job, candidates, options = {}) {
    const { 
      concurrency = 10, // Increased from 5 for faster processing
      style = 'balanced'
    } = options;
    const results = [];
    const startTime = Date.now();
    // Process in batches
    for (let i = 0; i < candidates.length; i += concurrency) {
      const batch = candidates.slice(i, i + concurrency);
      
      const batchPromises = batch.map(candidate => 
        this.fastScreenCandidate(job, candidate, { style })
          .then(result => ({
            candidateId: candidate.userId || candidate.id,
            candidateName: `${candidate.firstName || candidate.user?.firstName || ''} ${candidate.lastName || candidate.user?.lastName || ''}`.trim(),
            ...result
          }))
          .catch(error => ({
            candidateId: candidate.userId || candidate.id,
            success: false,
            error: error.message,
            matchScore: 0
          }))
      );
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    // Sort by match score descending
    results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    return {
      results,
      totalCandidates: candidates.length,
      processingTimeMs: Date.now() - startTime,
      shortlisted: results.filter(r => r.decision === 'shortlist'),
      maybes: results.filter(r => r.decision === 'maybe'),
      rejected: results.filter(r => r.decision === 'reject')
    };
  }
  // Helper methods for fast screening
  _calculateYearsExp(experience) {
    if (!experience || !Array.isArray(experience)) return 0;
    let totalMonths = 0;
    const now = new Date();
    
    experience.forEach(exp => {
      try {
        const start = exp.startDate ? new Date(exp.startDate) : null;
        const end = exp.current || !exp.endDate ? now : new Date(exp.endDate);
        if (start && !isNaN(start.getTime())) {
          totalMonths += Math.max(0, (end - start) / (1000 * 60 * 60 * 24 * 30));
        }
      } catch (e) {}
    });
    
    return Math.round(totalMonths / 12 * 10) / 10;
  }
  _getExperienceRange(level) {
    const ranges = {
      'entry': '0-1 years',
      'junior': '1-3 years',
      'mid': '3-6 years',
      'senior': '6-10 years',
      'lead': '8-12 years',
      'executive': '12+ years'
    };
    return ranges[level] || '3-5 years';
  }
  _extractTopSkills(skills, limit = 15) {
    if (!skills) return [];
    const allSkills = [];
    
    if (Array.isArray(skills)) {
      allSkills.push(...skills);
    } else if (typeof skills === 'object') {
      Object.values(skills).forEach(category => {
        if (Array.isArray(category)) allSkills.push(...category);
      });
    }
    
    return [...new Set(allSkills)].slice(0, limit);
  }
  _extractRecentRoles(experience, limit = 3) {
    if (!experience || !Array.isArray(experience)) return [];
    
    return experience
      .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))
      .slice(0, limit)
      .map(exp => ({
        title: exp.title || exp.position,
        company: exp.company,
        duration: exp.current ? 'Current' : `${exp.startDate?.substring(0, 7) || '?'} - ${exp.endDate?.substring(0, 7) || '?'}`
      }));
  }
  _summarizeEducation(education) {
    if (!education || !Array.isArray(education) || education.length === 0) {
      return 'Not specified';
    }
    const latest = education[0];
    return `${latest.degree || ''} ${latest.field || ''} - ${latest.school || latest.institution || ''}`.trim();
  }
}
module.exports = new AIService();
