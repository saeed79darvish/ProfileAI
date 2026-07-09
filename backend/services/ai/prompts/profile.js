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

/**
 * LinkedIn Profile Analyzer — recruiter/hiring-manager perspective.
 *
 * Asked to evaluate whether the user's LinkedIn profile would get them
 * shortlisted when a recruiter searches for `targetTitle` using LinkedIn
 * Recruiter / LinkedIn Search. Returns strict JSON so the UI can render
 * scores, section-by-section feedback, keyword chips, and paste-ready
 * rewrites.
 *
 * `scraped` is whatever we could pull from the profile page — some fields
 * may be missing (LinkedIn's DOM changes constantly). The prompt is
 * defensive: it grades what's present, calls out anything missing, and
 * never invents metrics.
 */
const linkedInProfileAnalysisPrompt = (scraped, targetTitle) => {
  const trim = (v, n) => {
    if (v == null) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > n ? s.slice(0, n) + '…' : s;
  };
  return `You are a senior technical recruiter and hiring manager at a top-tier tech company. You spend most of your day inside LinkedIn Recruiter searching for candidates.

Evaluate the LinkedIn profile below AS IF you were deciding whether to shortlist this person for a "${targetTitle || 'their stated title'}" role.

Two lenses:
1. RECRUITER FIT — would you shortlist this person based on what the profile says?
2. SEARCH VISIBILITY — would this profile even surface in a Boolean/keyword search for "${targetTitle || 'their target title'}" on LinkedIn Recruiter? (Headline, current title, About, and Skills carry the most weight in LinkedIn search; buried keywords in old experience carry very little.)

${VOICE_AND_TONE}

Additional rules for this task:
- Grade honestly. Do NOT be generous to spare feelings. A generic headline is a real problem.
- Never invent metrics, employers, or achievements. If the source doesn't say it, don't put it in a rewrite.
- Suggested rewrites must be paste-ready — no placeholders like "[X years]" or "[Company]".
- Keyword lists are for LinkedIn Boolean search. Prefer exact terms recruiters type ("React Native", not "cross-platform mobile"). Cap each list at 10.

TARGET TITLE: ${targetTitle || '(unspecified — infer from the profile\'s own headline / current role)'}

SCRAPED LINKEDIN PROFILE:
Name: ${trim(scraped.name, 120)}
Headline: ${trim(scraped.headline, 400)}
Location: ${trim(scraped.location, 120)}
Current role: ${trim(scraped.currentTitle, 200)} at ${trim(scraped.currentCompany, 200)}
About: ${trim(scraped.about, 3000)}
Experience: ${trim(scraped.experience, 4000)}
Education: ${trim(scraped.education, 1000)}
Skills: ${trim(scraped.skills, 1500)}
Featured items: ${scraped.featuredCount ?? 'unknown'}
Recommendations received: ${scraped.recommendationsCount ?? 'unknown'}
Followers/connections: ${trim(scraped.followers || scraped.connections, 120)}
Profile URL: ${trim(scraped.url, 200)}

Return ONLY a single valid JSON object with EXACTLY this shape (no prose, no code fences):

{
  "overallScore": 0-100,
  "recruiterFitScore": 0-100,
  "searchVisibilityScore": 0-100,
  "verdict": "shortlist" | "maybe" | "pass",
  "summary": "One paragraph (2-3 sentences), your honest recruiter take.",
  "sections": [
    {
      "name": "Headline",
      "score": 0-100,
      "current": "The current text (or empty string if missing).",
      "findings": ["Short bullets calling out what's wrong or missing."],
      "suggestion": "Paste-ready rewrite — under 220 chars, keyword-rich, includes seniority."
    },
    { "name": "About", "score": 0-100, "current": "...", "findings": [...], "suggestion": "3-5 short paragraphs, first person, keyword-rich, no banned words." },
    { "name": "Experience", "score": 0-100, "current": "", "findings": [...], "suggestion": "One example rewrite of the CURRENT role's bullets — 3-5 tight bullets that would make a recruiter stop scrolling." },
    { "name": "Skills", "score": 0-100, "current": "", "findings": [...], "suggestion": "Comma-separated list of the top 15 skills this profile SHOULD pin, in priority order for LinkedIn search." },
    { "name": "Featured", "score": 0-100, "current": "", "findings": [...], "suggestion": "What to add to the Featured section (e.g. link to a shipped app, a talk, a GitHub project)." },
    { "name": "Recommendations", "score": 0-100, "current": "", "findings": [...], "suggestion": "Who to ask and what to ask them to focus on." }
  ],
  "recruiterSearch": {
    "targetTitle": "${targetTitle || ''}",
    "presentKeywords": ["Keywords a recruiter searching for this title WOULD find in this profile."],
    "missingKeywords": ["Keywords a recruiter WOULD type but that are NOT anywhere prominent in the profile."],
    "recommendedKeywords": ["Top 10 keywords this profile should own for search visibility, in priority order."],
    "searchabilityTips": [
      "Concrete tactical tips like: 'Move \\"React Native\\" from bullet 4 of your 2019 job into your headline — LinkedIn weights headline text ~5x more than old experience.'"
    ]
  },
  "priorityFixes": [
    "3-5 things to do TODAY, ordered by impact. Each one specific and actionable."
  ]
}`;
};

module.exports = {
  enhancedSummaryPrompt,
  identifyStrengthsPrompt,
  recruiterInsightsPrompt,
  extractKeywordsPrompt,
  careerAdvicePrompt,
  linkedInProfileAnalysisPrompt
};
