/**
 * Resume AI Prompts
 * 
 * All AI prompts used for resume parsing, enhancement, gap analysis, and tailoring.
 */

// ═══════════════════════════════════════════════════════════════
// PARSING PROMPTS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate prompt for AI-based resume parsing
 * @param {string} resumeText - Raw resume text
 * @returns {Object} Prompt configuration
 */
function parseResumePrompt(resumeText) {
  return {
    system: 'You are an expert resume parser that extracts structured data from resume text. Always return valid JSON.',
    prompt: `You are an expert resume parser. Analyze the following resume and extract structured information.

Resume Text:
${resumeText}

Extract and return a JSON object with the following structure:
{
  "firstName": "First name of the person (string)",
  "lastName": "Last name of the person (string)",
  "email": "Email address if available (string or null)",
  "title": "Job title or desired position (string)",
  "location": "City, State or Country (string)",
  "phone": "Phone number if available (string or null)",
  "website": "Personal website URL if available (string or null)",
  "linkedinUrl": "LinkedIn profile URL if available (string or null)",
  "githubUrl": "GitHub profile URL if available (string or null)",
  "summary": "A professional summary or objective (string, 2-3 sentences)",
  "skills": ["skill1", "skill2", "skill3", ...] (array of strings),
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "startDate": "YYYY-MM-DD format (e.g., 2020-01-01). Use first day of month if only month/year given.",
      "endDate": "YYYY-MM-DD format or null if current position",
      "current": true/false (boolean indicating if currently working here),
      "description": "Brief description of responsibilities and achievements"
    }
  ],
  "education": [
    {
      "institution": "School/University Name",
      "degree": "Degree type (e.g., Bachelor's, Master's)",
      "field": "Field of study",
      "startDate": "YYYY-MM-DD or null",
      "endDate": "YYYY-MM-DD or null",
      "current": true/false,
      "gpa": "GPA if available (string or null)"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "technologies": ["tech1", "tech2"]
    }
  ]
}

Important:
- Extract ALL work experiences found, in chronological order (most recent first)
- For dates, convert to YYYY-MM-DD format. Use "01" for day if not specified.
- If currently employed, set "current": true and "endDate": null
- Be thorough in extracting skills from both explicit skills sections and within experience descriptions
- Return ONLY the JSON object, no additional text or markdown.`,
    max_tokens: 3000,
    temperature: 0.3
  };
}

// ═══════════════════════════════════════════════════════════════
// ENHANCEMENT PROMPTS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate prompt for profile enhancement
 * @param {Object} profileData - Current profile data
 * @param {string} customPrompt - Optional custom instructions
 * @returns {Object} Prompt configuration
 */
function enhanceProfilePrompt(profileData, customPrompt = '') {
  const customInstructions = customPrompt
    ? `\n\nAdditional instructions from the user:\n"${customPrompt}"\nPlease incorporate these instructions into your enhancements while following the guidelines above.`
    : '';

  return {
    system: 'You are an expert career coach and resume writer who helps professionals present themselves in the best possible light while maintaining accuracy.',
    prompt: `You are an expert career coach and resume writer. Analyze the following profile data and enhance it to make it more compelling and professional. 

Current Profile Data:
${JSON.stringify(profileData, null, 2)}

Please enhance this profile by:
1. Improving the professional summary to be more impactful and highlight unique value
2. Making experience descriptions more action-oriented with quantifiable achievements where possible
3. Organizing and prioritizing skills by relevance and impact
4. Enhancing project descriptions to highlight technical complexity and impact
5. Ensuring the overall presentation is polished and professional

Return a JSON object with the same structure as the input, but with enhanced content:
{
  "title": "Enhanced job title (more impactful if appropriate)",
  "summary": "Enhanced 3-4 sentence professional summary that sells the candidate",
  "skills": ["prioritized", "relevant", "skills", "array"],
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "period": "Period",
      "description": "Enhanced description with action verbs and achievements"
    }
  ],
  "education": [
    {
      "institution": "Institution",
      "degree": "Degree",
      "field": "Field",
      "period": "Period"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Enhanced description highlighting impact and technical complexity",
      "technologies": ["tech1", "tech2"]
    }
  ],
  "enhancements": {
    "summaryChanges": "Brief explanation of summary improvements",
    "experienceChanges": "Brief explanation of experience improvements",
    "skillsChanges": "Brief explanation of skills organization",
    "overallTips": ["Tip 1 for further improvement", "Tip 2", "Tip 3"]
  }
}

Important: Maintain factual accuracy - enhance wording and presentation, don't fabricate achievements.
Return ONLY valid JSON, no additional text.${customInstructions}`,
    max_tokens: 3000,
    temperature: 0.7
  };
}

/**
 * Generate prompt for enhancement suggestions
 * @param {Object} profileData - Current profile data
 * @returns {Object} Prompt configuration
 */
function enhancementSuggestionsPrompt(profileData) {
  return {
    system: 'You are a career coach providing specific, actionable feedback to improve professional profiles.',
    prompt: `You are an expert career coach. Review this profile and provide specific, actionable suggestions to improve it.

Profile Data:
${JSON.stringify(profileData, null, 2)}

Provide suggestions in the following JSON format:
{
  "summaryTips": [
    {"current": "issue with current summary", "suggestion": "specific improvement suggestion"}
  ],
  "experienceTips": [
    {"role": "Job Title at Company", "tip": "specific suggestion to improve this experience entry"}
  ],
  "skillsTips": [
    {"tip": "suggestion about skills organization or missing skills"}
  ],
  "projectTips": [
    {"project": "Project Name", "tip": "suggestion to improve project description"}
  ],
  "generalTips": [
    "Overall suggestion 1",
    "Overall suggestion 2"
  ],
  "missingElements": [
    "Element that would strengthen the profile"
  ],
  "strengthsToHighlight": [
    "Strength that should be emphasized more"
  ]
}

Be specific and actionable. Return ONLY valid JSON.`,
    max_tokens: 2000,
    temperature: 0.7
  };
}

// ═══════════════════════════════════════════════════════════════
// GAP ANALYSIS PROMPTS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate prompt for resume gap analysis
 * @param {Object} profileData - Candidate profile
 * @param {string} jobDescription - Job posting text
 * @param {string|null} originalResumeText - Raw resume text if available
 * @returns {Object} Prompt configuration
 */
function gapAnalysisPrompt(profileData, jobDescription, originalResumeText = null) {
  const hasResume = originalResumeText && originalResumeText.trim().length > 100;

  const candidateInfo = hasResume
    ? `CANDIDATE'S RESUME:\n${originalResumeText}\n\nSTRUCTURED DATA (supplementary):\n${JSON.stringify(profileData, null, 2)}`
    : `CANDIDATE'S PROFILE:\n${JSON.stringify(profileData, null, 2)}`;

  return {
    system: 'You analyze skill gaps between candidate profiles and job descriptions. Return only valid JSON.',
    prompt: `You are a career gap analyst. Compare the candidate's profile/resume against the job description and identify skill/requirement gaps — but you MUST correctly handle OR-patterns, preferred vs required language, and technology families.

${candidateInfo}

JOB DESCRIPTION:
${jobDescription}

═══ CRITICAL RULES FOR GAP DETECTION ═══

1. OR-PATTERN DETECTION:
   When a job description lists alternatives (e.g., "React, Angular, or Vue.js", "Python or Java", "AWS or Azure or GCP"),
   the candidate only needs ONE of the alternatives to satisfy the requirement.
   - If the candidate has React, do NOT flag Vue.js or Angular as gaps.
   - Only flag a gap if the candidate has NONE of the listed alternatives.

2. TECHNOLOGY FAMILY GROUPING:
   Treat equivalent technologies in the same family as interchangeable:
   - Frontend frameworks: React, Vue.js, Angular, Svelte
   - Backend languages: Python, Java, C#, Go, Node.js
   - Cloud providers: AWS, Azure, GCP
   - Databases: PostgreSQL, MySQL, MongoDB, DynamoDB
   - Container orchestration: Kubernetes, Docker Swarm, ECS
   If the job requires "a frontend framework" and the candidate has React, do NOT flag other frameworks.

3. REQUIRED vs PREFERRED LANGUAGE:
   - "Required", "must have", "essential", "mandatory" → severity "critical", type "required"
   - "Preferred", "nice to have", "bonus", "ideally", "a plus", "desirable" → severity "nice_to_have", type "nice_to_have"
   - "Strongly preferred", "highly desired" → severity "important", type "nice_to_have"

4. IMPLIED/ADJACENT SKILLS:
   Do NOT flag skills that are implied by what the candidate already has:
   - React → JSX, component architecture, virtual DOM (not gaps)
   - Python → pip, basic scripting (not gaps)
   - Full-stack developer → basic understanding of both frontend and backend (not gaps)

5. suggest_adding FIELD:
   - Set to true ONLY if the candidate genuinely lacks this skill AND it's not covered by an OR-alternative they already have.
   - Set to false if the candidate already satisfies the requirement via an OR-pattern alternative or technology family equivalent.

For each gap found, return a JSON array where each element has:
- "skill": The specific skill, technology, or requirement (concise, 2-5 words)
- "category": One of "technical", "experience", "certification", "soft_skill", "domain_knowledge"
- "severity": One of "critical" (must-have), "important" (strongly preferred), "nice_to_have"
- "type": One of "required" (job explicitly requires it) or "nice_to_have" (preferred/optional/one of several alternatives)
- "suggest_adding": boolean — true if this is a genuine gap the candidate should address, false if already covered by an alternative
- "reason": 1-sentence explanation of WHY this is or isn't a real gap (mention OR-patterns if applicable)
- "description": A 1-sentence explanation of the gap
- "learningResource": A specific suggestion for how to learn/acquire this

Rules:
- Include BOTH genuine gaps (suggest_adding: true) AND satisfied alternatives (suggest_adding: false) so the user can see the full picture
- Do NOT list skills the candidate clearly already has as gaps
- Order by: suggest_adding true first, then by severity (critical → important → nice_to_have)
- Maximum 15 gaps

Return ONLY a JSON array, no additional text.`,
    max_tokens: 2000,
    temperature: 0.4
  };
}

// ═══════════════════════════════════════════════════════════════
// KEYWORD EXTRACTION PROMPTS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate prompt for job keyword extraction
 * @param {string} jobDescription - Job posting text
 * @returns {Object} Prompt configuration
 */
function extractKeywordsPrompt(jobDescription) {
  return {
    system: 'You extract SKILLS and TOOLS from job postings for ANY industry. You detect OR-patterns and alternative skill groups. Return ONLY valid JSON, nothing else.',
    prompt: `Extract ONLY the specific skills, tools, technologies, certifications, and methodologies from this job posting.

JOB POSTING:
${jobDescription}

Return JSON:
{
  "required": ["ONLY specific skills/tools/technologies that are REQUIRED — each item should be a single skill name like 'Vue.js', 'Python', 'REST APIs', 'Agile', 'PMP certification'"],
  "preferred": ["skills/tools listed as preferred/nice-to-have/bonus — same format, single skill names only"],
  "soft": ["soft skills — like 'cross-functional collaboration', 'mentoring', 'problem-solving'"],
  "domain": ["domain-specific technical terms — like 'distributed systems', 'microservices', 'data visualization'"],
  "orGroups": [["React", "Vue.js", "Angular"], ["AWS", "Azure", "GCP"]],
  "jobTitle": "exact job title from posting",
  "company": "company name if mentioned"
}

CRITICAL RULES — what to INCLUDE vs EXCLUDE:
INCLUDE: Specific skill names, tool names, framework names, language names, methodology names, certification names
  Examples: "Vue.js", "Python", "REST APIs", "Agile", "cross-browser compatibility", "object-oriented design", "data structures"
EXCLUDE — do NOT include any of these:
  - Degree requirements (e.g., "Bachelors in computer science" — this is NOT a skill)
  - Years of experience (e.g., "5+ years of experience" — this is NOT a skill)
  - Vague phrases (e.g., "equivalent experience", "related engineering")
  - Job duties/descriptions (e.g., "working on frontend design", "collecting requirements")
  - Sentence fragments (e.g., "design solutions to mitigate them")

OR-GROUPS RULE:
When the job posting lists alternatives (e.g., "React, Angular, or Vue.js", "Python or Java", "AWS or Azure"),
include each individual skill in the required/preferred arrays AND also list the group in "orGroups".
Each orGroup is an array of the alternative skills that satisfy the SAME requirement.
If there are no OR-patterns, return "orGroups": [].
  
Each item in the arrays must be a SHORT skill/tool name (1-5 words max). No sentences.`,
    max_tokens: 1000,
    temperature: 0.1
  };
}

// ═══════════════════════════════════════════════════════════════
// TAILORING PROMPTS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate prompt for resume tailoring with uploaded resume
 * @param {Object} options - Tailoring options
 * @returns {Object} Prompt configuration
 */
function tailorWithResumePrompt(options) {
  const {
    originalResumeText,
    jobDescription,
    extractedKeywords,
    gapContext,
    settingsContext,
    expCount
  } = options;

  const orGroups = extractedKeywords.orGroups || [];
  const orGroupsBlock = orGroups.length > 0 ? `
OR-GROUPS (alternatives — the candidate only needs ONE from each group):
${orGroups.map((group, i) => `  Group ${i + 1}: ${group.join(' OR ')}`).join('\n')}
If the candidate already has a skill from an OR-group, do NOT replace it with another from the same group. The existing skill takes priority.
` : '';

  return {
    system: 'You are a professional resume editor. You tailor resumes by enriching content, never replacing existing technologies or skills.',
    prompt: `You are a professional resume editor. Your job is to tailor the candidate's resume to better match a job description by incorporating accepted skill gaps — WITHOUT misrepresenting the candidate's experience.

═══ CANDIDATE'S ORIGINAL RESUME ═══
${originalResumeText}

═══ TARGET JOB DESCRIPTION ═══
${jobDescription}
${gapContext}${settingsContext}
═══ KEY TECHNICAL TERMS FROM THE JOB (use these exact terms, not generic alternatives) ═══
${(extractedKeywords.required || []).join(', ')}${(extractedKeywords.preferred || []).length > 0 ? '\nAlso valued: ' + (extractedKeywords.preferred || []).join(', ') : ''}
${(extractedKeywords.domain || []).length > 0 ? 'Domain terms: ' + (extractedKeywords.domain || []).join(', ') : ''}
${orGroupsBlock}
═══ HOW TO TAILOR — ENRICH, NEVER REPLACE ═══

FUNDAMENTAL RULE: NEVER replace an existing technology/skill with a different one. Only ADD new skills alongside existing ones.

1. SKILLS:
   - Start with ALL of the candidate's existing skills (preserve every one).
   - ADD any technical terms from the job that the candidate can credibly claim.
   - ADD all accepted gap keywords here — this is the safest place for ATS keyword coverage.
   - Be generous with additions here.

2. SUMMARY — ENRICH, DON'T REPLACE:
   - Keep the summary almost WORD-FOR-WORD identical to the original.
   - NEVER replace existing technology names. Instead, ADD new ones alongside them.
   - Example: Original says "React" and job values "Vue.js" → write "React/Vue.js" or "React, with Vue.js exposure" — NEVER remove React.
   - Accepted gap skills can be mentioned as COMPLEMENTARY additions, keeping the candidate's primary stack front-and-center.
   - The result should be very close to the original, with at most 2-3 small ADDITIONS (not replacements).

3. EXPERIENCE — ENRICH WITH CARE:
   This resume has ${expCount} entries.

   ENTRY 1 (most recent role):
   - Read the original description carefully.
   - Find 2-3 places where a gap keyword can be ADDED alongside existing mentions (not replacing them).
   - NEVER rewrite sentences. Only append/enrich phrases.
   - Maximum 2 gap keywords added per experience entry to avoid keyword stuffing.

   ENTRY 2 (second most recent):
   - Same approach: find 2-3 DIFFERENT enrichment opportunities (use different gap terms than Entry 1).
   - Everything else stays word-for-word identical.

   ENTRIES 3 through ${expCount} (older roles):
   - COPY VERBATIM. Zero keyword changes. At most fix a typo.

4. EDUCATION: Copy VERBATIM.

5. PROJECTS: Copy almost verbatim. At most 1 small addition per project.

═══ CHANGELOG ═══
Track every change you made. Return a "changelog" array in your JSON output.

═══ OUTPUT FORMAT ═══
Return a JSON object with this structure:
{
  "title": "Job title",
  "summary": "Tailored summary",
  "skills": ["skill1", "skill2", ...],
  "experience": [{ "company": "", "title": "", "startDate": "", "endDate": "", "description": "" }],
  "education": [{ "institution": "", "degree": "", "field": "" }],
  "projects": [{ "name": "", "description": "", "technologies": [] }],
  "changelog": ["Change 1: added X to skills", "Change 2: ..."]
}

Return ONLY valid JSON.`,
    max_tokens: 4000,
    temperature: 0.3
  };
}

/**
 * Generate prompt for resume tailoring from profile data only
 * @param {Object} options - Tailoring options
 * @returns {Object} Prompt configuration
 */
function tailorFromProfilePrompt(options) {
  const {
    profileData,
    jobDescription,
    extractedKeywords,
    gapContext,
    settingsContext,
    expCount
  } = options;

  const orGroups = extractedKeywords.orGroups || [];
  const orGroupsBlock = orGroups.length > 0 ? `
OR-GROUPS (alternatives — the candidate only needs ONE from each group):
${orGroups.map((group, i) => `  Group ${i + 1}: ${group.join(' OR ')}`).join('\n')}
` : '';

  return {
    system: 'You are a professional resume editor. You tailor resumes by enriching content, never replacing existing technologies or skills.',
    prompt: `You are a professional resume editor. Your job is to tailor the candidate's profile to better match a job description.

═══ CANDIDATE'S PROFILE ═══
${JSON.stringify(profileData, null, 2)}

═══ TARGET JOB DESCRIPTION ═══
${jobDescription}
${gapContext}${settingsContext}
═══ KEY TECHNICAL TERMS FROM THE JOB ═══
Required: ${(extractedKeywords.required || []).join(', ')}
Preferred: ${(extractedKeywords.preferred || []).join(', ')}
Domain: ${(extractedKeywords.domain || []).join(', ')}
${orGroupsBlock}
═══ TAILORING RULES ═══

1. SKILLS: Start with ALL existing skills, then ADD job-relevant terms the candidate can credibly claim.

2. SUMMARY: Enhance to highlight job-relevant experience. ADD new terms alongside existing ones, never replace.

3. EXPERIENCE (${expCount} entries):
   - Entries 1-2: Enhance descriptions with job-relevant terms (max 2 additions per entry)
   - Entries 3+: Minimal changes

4. EDUCATION: Keep mostly unchanged.

5. PROJECTS: Add job-relevant context where natural.

═══ OUTPUT FORMAT ═══
Return a JSON object:
{
  "title": "Job title",
  "summary": "Tailored summary",
  "skills": ["skill1", "skill2", ...],
  "experience": [{ "company": "", "title": "", "startDate": "", "endDate": "", "description": "" }],
  "education": [{ "institution": "", "degree": "", "field": "" }],
  "projects": [{ "name": "", "description": "", "technologies": [] }],
  "changelog": ["Change 1", "Change 2", ...]
}

Return ONLY valid JSON.`,
    max_tokens: 4000,
    temperature: 0.3
  };
}

// ═══════════════════════════════════════════════════════════════
// INTERVIEW PREP PROMPTS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate prompt for interview preparation guide
 * @param {Object} context - Interview context
 * @returns {Object} Prompt configuration
 */
function interviewPrepPrompt(context) {
  const {
    jobTitle,
    companyName,
    interviewLevel,
    interviewFormat,
    specificConcerns,
    skillGaps,
    matchAnalysis,
    jobLevel,
    candidateProfile
  } = context;

  const gapsList = skillGaps.map(g => `${g.skill} (${g.severity || 'unknown'} severity)`).join(', ');
  const strongList = (matchAnalysis.strongMatches || []).join(', ');
  const gapNames = (matchAnalysis.gaps || []).join(', ');

  return {
    system: 'You are an expert interview coach who prepares candidates for tech interviews. You give specific, actionable advice based on the candidate\'s profile and gaps. Always return valid JSON only.',
    prompt: `You are an expert interview coach. A candidate is preparing for a specific interview. Generate a comprehensive, personalized interview preparation guide.

═══ CONTEXT ═══
Job Title: ${jobTitle}
Company: ${companyName || 'Not specified'}
Position Level: ${jobLevel.level || 'Unknown'} (${jobLevel.yearsExpected || 'N/A'} expected)
${jobLevel.summary ? `Level Details: ${jobLevel.summary}` : ''}

═══ INTERVIEW DETAILS ═══
Interview Round/Stage: ${interviewLevel}
Interview Format: ${interviewFormat}
${specificConcerns ? `Candidate's Specific Concerns: ${specificConcerns}` : ''}

═══ CANDIDATE CONTEXT ═══
Current Role: ${candidateProfile.headline}
Key Skills: ${Array.isArray(candidateProfile.skills) ? candidateProfile.skills.slice(0, 20).join(', ') : 'N/A'}

═══ GAP ANALYSIS ═══
Strong Matches: ${strongList || 'None identified'}
Skill Gaps: ${gapsList || 'None identified'}
Missing Requirements: ${gapNames || 'None identified'}

═══ YOUR TASK ═══
Generate a DETAILED interview prep guide specifically for this "${interviewLevel}" round. The prep should be highly specific to:
1. The interview round/stage (e.g., phone screen questions are different from onsite system design)
2. The candidate's gaps (help them prepare for tricky questions about their weak areas)
3. The position level (${jobLevel.level || 'unknown'} level expectations)

Return a JSON object with this EXACT structure:
{
  "roundOverview": "2-3 sentence overview of what to expect in this specific interview round",
  "expectedTopics": ["List of 5-8 specific topics likely to come up in THIS round"],
  "technicalQuestions": [
    {
      "question": "A specific technical question",
      "whyAsked": "Why this is likely to be asked",
      "suggestedApproach": "How to approach answering this",
      "relatedGap": "Which skill gap this relates to, if any"
    }
  ],
  "behavioralQuestions": [
    {
      "question": "A specific behavioral question",
      "whyAsked": "Why this is relevant",
      "starExample": "A suggested STAR structure"
    }
  ],
  "questionsToAsk": ["3-5 thoughtful questions the candidate should ask"],
  "talkingPoints": ["5-7 achievements they should proactively mention"],
  "gapMitigation": [
    {
      "gap": "The skill gap",
      "strategy": "How to handle questions about this gap"
    }
  ],
  "areasToStudy": [
    {
      "topic": "Topic to study",
      "priority": "high|medium|low",
      "resources": "Suggested resources"
    }
  ],
  "dosAndDonts": {
    "dos": ["4-5 do's"],
    "donts": ["4-5 don'ts"]
  },
  "levelExpectations": "What is expected at the ${jobLevel.level || 'this'} level",
  "timelinePlan": "Suggested study timeline"
}

Generate 4-6 technical questions and 3-4 behavioral questions. Be highly specific.
Return ONLY valid JSON.`,
    max_tokens: 4000,
    temperature: 0.6
  };
}

module.exports = {
  // Parsing
  parseResumePrompt,
  
  // Enhancement
  enhanceProfilePrompt,
  enhancementSuggestionsPrompt,
  
  // Gap Analysis
  gapAnalysisPrompt,
  extractKeywordsPrompt,
  
  // Tailoring
  tailorWithResumePrompt,
  tailorFromProfilePrompt,
  
  // Interview
  interviewPrepPrompt
};
