/**
 * Profile-related AI prompts
 * Prompts for enhancing candidate profiles, generating summaries, etc.
 */

// Shared voice & tone block — kept in sync with backend/routes/profiles.js
// (enhance-text endpoint) and backend/services/resume/tailoringPrompts.js.
// The goal is for AI-generated profile content to read like a real person, not
// a press release full of buzzwords.
const VOICE_AND_TONE = `VOICE & TONE — write like a real person, not a press release:
- BANNED WORDS — never use any of these (or close synonyms): "results-driven", "results-oriented", "detail-oriented", "passionate", "dynamic", "visionary", "synergy", "leverage", "spearheaded", "orchestrated", "utilized", "proven track record", "go-getter", "self-starter", "thought leader", "rockstar", "ninja", "guru", "world-class", "best-in-class", "cutting-edge", "next-generation", "transformative", "disruptive", "game-changing", "seamlessly", "robust", "scalable solutions" (as filler), "leveraging", "ecosystem", "synergize", "strategic vision", "extensive expertise", "demonstrated ability", "exceptional".
- BANNED OPENERS for bullets: "Responsible for", "Worked on", "Helped with", "Was part of", "Tasked with", "Duties included".
- Plain-English action verbs only (built, shipped, designed, wrote, led, fixed, migrated, debugged, mentored, owned, scoped, automated, refactored). Never start two consecutive bullets with the same verb.
- Concrete over abstract. Prefer "rebuilt the checkout flow in React" over "drove transformative customer experiences".
- Don't pad. Short sentences. No throat-clearing intros ("In my role as...", "Throughout my career...").
- If a number isn't in the source, do NOT invent one. Describe the work qualitatively.`;

/**
 * Generate an enhanced professional summary prompt
 */
const enhancedSummaryPrompt = (profileData) => `Rewrite this professional summary in plain, human English. Keep it short and specific.

${VOICE_AND_TONE}

Name: ${profileData.firstName} ${profileData.lastName}
Title: ${profileData.title}
Summary: ${profileData.summary || 'Not provided'}
Skills: ${JSON.stringify(profileData.skills)}
Experience: ${JSON.stringify(profileData.experience).substring(0, 1000)}

Guidelines:
- 3–5 short sentences. No multi-clause epics.
- Open with a concrete identity ("Android engineer with 10 years of experience shipping consumer apps"), not adjectives.
- Use only specialties and achievements present in the profile data above. Do NOT invent skills, employers, metrics, or years.
- End with what the person is looking for next, only if implied by the source.
- Absolutely no banned words.

LENGTH LIMIT: 1500 characters or fewer. Do not pad.

Return ONLY the summary text, nothing else.`;

/**
 * Identify strengths and competencies prompt
 */
const identifyStrengthsPrompt = (profileData) => `Analyze this professional profile and identify the top 5-7 key strengths and competencies. Return them as a JSON array of plain-English strings.

${VOICE_AND_TONE}

Title: ${profileData.title}
Summary: ${profileData.summary || ''}
Skills: ${JSON.stringify(profileData.skills)}
Experience: ${JSON.stringify(profileData.experience).substring(0, 1500)}
Projects: ${JSON.stringify(profileData.projects).substring(0, 800)}

Return only a JSON array of concrete strength statements grounded in the profile data, like:
["Leads cross-functional Android teams of 6+", "Ships consumer apps to 1M+ users", "Mentors junior engineers in Kotlin and Compose"]

Do NOT use banned words. Do NOT invent achievements not supported by the profile.`;

/**
 * Generate recruiter insights prompt
 */
const recruiterInsightsPrompt = (profileData) => `As a technical recruiter, analyze this candidate profile and provide key insights that would help in understanding their unique value, career trajectory, and ideal role fit. Write 2-3 paragraphs.
Name: ${profileData.firstName} ${profileData.lastName}
Title: ${profileData.title}
Summary: ${profileData.summary || ''}
Skills: ${JSON.stringify(profileData.skills)}
Experience: ${JSON.stringify(profileData.experience).substring(0, 2000)}
Projects: ${JSON.stringify(profileData.projects).substring(0, 1000)}
Provide insights about:
1. Career progression and growth pattern
2. Technical expertise and specializations
3. Impact and leadership potential
4. Ideal role recommendations`;

/**
 * Extract keywords for SEO prompt
 */
const extractKeywordsPrompt = (profileData) => `Extract 10-15 relevant professional keywords and technologies from this profile for search optimization. Return as a JSON array of strings.
Title: ${profileData.title}
Skills: ${JSON.stringify(profileData.skills)}
Experience: ${JSON.stringify(profileData.experience).substring(0, 1500)}
Return only a JSON array like: ["Project Management", "Data Analysis", "Strategic Planning", "Team Leadership"]`;

/**
 * Career advice prompt
 */
const careerAdvicePrompt = (profileData) => `As a career coach, provide personalized career advancement advice for this professional:
Current Title: ${profileData.title}
Years of Experience: ${profileData.experience?.length || 0} positions
Skills: ${JSON.stringify(Object.values(profileData.skills || {}).flat())}
Career Goals: ${profileData.careerGoals || 'Not specified'}
Provide advice on:
1. Next logical career steps (2-3 role suggestions)
2. Skills to develop for advancement (3-5 skills)
3. Certifications or education to consider
4. Industry trends to be aware of
5. Networking strategies
Format as structured advice with clear sections.`;

module.exports = {
  enhancedSummaryPrompt,
  identifyStrengthsPrompt,
  recruiterInsightsPrompt,
  extractKeywordsPrompt,
  careerAdvicePrompt
};
