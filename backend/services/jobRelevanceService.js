/**
 * Job Relevance Scoring Service
 * 
 * Scores external jobs against a candidate profile using text-based matching.
 * No AI calls — fast enough to run on every page load.
 */

/**
 * Curated list of common tech skill tokens used as a fallback when a
 * profile's structured `skills` field is empty (e.g. only category buckets
 * exist with no entries). Lowercase canonical form. Multi-word phrases use
 * a space; matching is whole-word/phrase insensitive.
 */
const SKILL_VOCAB = [
  // Languages
  'javascript', 'typescript', 'python', 'java', 'kotlin', 'swift', 'objective-c', 'go', 'golang',
  'rust', 'c++', 'c#', 'ruby', 'php', 'scala', 'elixir', 'dart', 'r', 'matlab', 'perl', 'lua',
  'sql', 'bash', 'shell', 'powershell', 'haskell', 'clojure', 'erlang', 'solidity',
  // Frontend frameworks/libs
  'react', 'react native', 'next.js', 'nextjs', 'vue', 'vue.js', 'nuxt', 'angular', 'svelte',
  'sveltekit', 'redux', 'mobx', 'zustand', 'tailwind', 'bootstrap', 'material-ui', 'chakra',
  'styled-components', 'emotion', 'webpack', 'vite', 'rollup', 'esbuild', 'parcel',
  'storybook', 'jest', 'vitest', 'cypress', 'playwright', 'testing-library', 'enzyme',
  'web animations api', 'webxr', 'three.js', 'd3.js', 'chart.js',
  // Backend frameworks
  'node.js', 'nodejs', 'node', 'express', 'fastify', 'nestjs', 'koa', 'hapi',
  'django', 'flask', 'fastapi', 'spring', 'spring boot', 'rails', 'laravel', 'symfony',
  'gin', 'echo', 'asp.net', '.net', 'phoenix',
  // Mobile
  'ios', 'android', 'flutter', 'xamarin', 'ionic',
  // Cloud / infra
  'aws', 'gcp', 'azure', 'lambda', 'ec2', 's3', 'rds', 'dynamodb', 'cloudfront', 'cloudfront cdn',
  'cloudwatch', 'sqs', 'sns', 'kinesis', 'eks', 'ecs', 'fargate', 'beanstalk', 'route53',
  'codepipeline', 'cloudformation', 'amplify',
  'kubernetes', 'k8s', 'docker', 'helm', 'terraform', 'pulumi', 'ansible', 'chef', 'puppet',
  'nginx', 'apache', 'cloudflare', 'fastly', 'vercel', 'netlify', 'heroku', 'digitalocean',
  // Databases
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'memcached', 'elasticsearch',
  'opensearch', 'cassandra', 'dynamodb', 'snowflake', 'bigquery', 'redshift', 'clickhouse',
  'sqlite', 'firestore', 'cosmosdb', 'neo4j', 'influxdb', 'timescaledb',
  // APIs / data
  'graphql', 'rest', 'rest api', 'grpc', 'websocket', 'websockets', 'webrtc', 'kafka',
  'rabbitmq', 'mqtt', 'pubsub', 'pulsar', 'protobuf',
  // CI/CD
  'github actions', 'jenkins', 'gitlab ci', 'circleci', 'travis', 'argo', 'argocd', 'spinnaker',
  // Architectures / patterns
  'microservices', 'micro frontend', 'micro frontends', 'module federation', 'monorepo',
  'serverless', 'event-driven', 'event driven', 'cqrs', 'ddd', 'soa', 'mvc', 'tdd', 'bdd',
  'design system', 'design systems', 'component library', 'component libraries',
  'i18n', 'a11y', 'accessibility', 'ssr', 'ssg', 'pwa',
  // AI / data
  'machine learning', 'deep learning', 'pytorch', 'tensorflow', 'keras', 'scikit-learn',
  'huggingface', 'transformers', 'langchain', 'llamaindex', 'openai', 'anthropic', 'claude',
  'gpt', 'llm', 'llms', 'rag', 'vector database', 'pinecone', 'weaviate', 'chroma',
  'pandas', 'numpy', 'spark', 'airflow', 'dbt', 'kafka streams',
  // Tooling
  'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence', 'figma', 'sketch',
  'linux', 'macos', 'unix',
  // Soft / role-ish (kept because job descriptions reference them too)
  'agile', 'scrum', 'kanban', 'leadership', 'mentorship',
];
const SKILL_VOCAB_SET = new Set(SKILL_VOCAB);

/**
 * Mine skill tokens out of free-form text (experience descriptions, summary,
 * title) by matching against SKILL_VOCAB. Used as a fallback when the
 * profile's structured `skills` field is empty.
 */
function mineSkillsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  const found = new Set();
  for (const token of SKILL_VOCAB) {
    // word boundary match; for tokens with special chars (./+#-) fall back to substring
    const hasSpecial = /[^a-z0-9 ]/.test(token);
    if (hasSpecial) {
      if (lower.includes(token)) found.add(token);
    } else {
      // build word-boundary regex for whole-word/phrase match
      const re = new RegExp(`(?:^|[^a-z0-9])${token.replace(/ /g, '\\s+')}(?:[^a-z0-9]|$)`, 'i');
      if (re.test(lower)) found.add(token);
    }
  }
  return [...found];
}

/**
 * Extract all skill names from a profile's skills object.
 * Profile.skills is JSONB like: { frontend: ["React", "TypeScript"], backend: ["Node.js"] }
 * or { core: [], soft: [], industry: [], software: [], technical: [] }.
 *
 * Falls back to mining skills from experience descriptions + summary + title
 * when the explicit skills list is empty (some profiles only have the
 * category buckets with no entries).
 */
function extractSkills(profile) {
  const skills = profile.skills;
  let explicit = [];
  if (Array.isArray(skills)) {
    explicit = skills.map(s => (typeof s === 'string' ? s : s.name || '').toLowerCase()).filter(Boolean);
  } else if (skills && typeof skills === 'object') {
    explicit = Object.values(skills).flat().map(s => (typeof s === 'string' ? s : '').toLowerCase()).filter(Boolean);
  }
  if (explicit.length > 0) return explicit;

  // Fallback: mine from free-form profile text
  const parts = [];
  if (profile.title) parts.push(String(profile.title));
  if (profile.headline) parts.push(String(profile.headline));
  if (profile.summary) parts.push(String(profile.summary));
  if (Array.isArray(profile.experience)) {
    for (const e of profile.experience) {
      if (e.position) parts.push(String(e.position));
      if (e.title) parts.push(String(e.title));
      if (e.description) parts.push(String(e.description));
    }
  }
  if (Array.isArray(profile.projects)) {
    for (const p of profile.projects) {
      if (p.name) parts.push(String(p.name));
      if (p.description) parts.push(String(p.description));
      if (Array.isArray(p.technologies)) parts.push(p.technologies.join(' '));
    }
  }
  return mineSkillsFromText(parts.join(' \n '));
}

/**
 * Extract keywords from experience entries (position titles + descriptions).
 */
function extractExperienceKeywords(profile) {
  const exp = profile.experience;
  if (!Array.isArray(exp)) return { titles: [], keywords: [] };
  
  const titles = exp.map(e => (e.position || e.title || '').toLowerCase()).filter(Boolean);
  const descriptions = exp.map(e => (e.description || '').toLowerCase()).join(' ');
  
  // Extract meaningful words from descriptions (4+ chars, no stop words)
  const stopWords = new Set(['with', 'that', 'this', 'from', 'they', 'been', 'have', 'were', 'will', 'each', 'make', 'like', 'just', 'over', 'such', 'than', 'them', 'very', 'when', 'what', 'your', 'about', 'their', 'which', 'would', 'there', 'could', 'other', 'into', 'more', 'some', 'these', 'also', 'well', 'using', 'including', 'based', 'across', 'through']);
  const words = descriptions.match(/\b[a-z]{4,}\b/g) || [];
  const keywords = [...new Set(words.filter(w => !stopWords.has(w)))];
  
  return { titles, keywords };
}

/**
 * Compute years of experience from profile.
 */
function computeYearsOfExperience(profile) {
  const exp = profile.experience;
  if (!Array.isArray(exp) || exp.length === 0) return 0;
  
  let totalMonths = 0;
  for (const entry of exp) {
    const start = entry.startDate ? new Date(entry.startDate) : null;
    const end = entry.current ? new Date() : (entry.endDate ? new Date(entry.endDate) : null);
    if (start && end && !isNaN(start) && !isNaN(end)) {
      totalMonths += Math.max(0, (end - start) / (1000 * 60 * 60 * 24 * 30));
    }
  }
  return Math.round(totalMonths / 12);
}

/**
 * Map years of experience to expected experience level.
 * If years can't be computed (0) but the profile title hints at seniority,
 * fall back to the title-derived level.
 */
function inferExperienceLevel(years, profileTitle = '') {
  // Strong title signals override a 0-years-of-experience reading, which
  // is usually a sign that experience entry dates didn't parse — not that
  // the candidate is actually entry-level.
  if (!years || years <= 0) {
    const t = String(profileTitle || '').toLowerCase();
    if (/\b(staff|principal|distinguished|fellow)\b/.test(t)) return 'lead';
    if (/\b(lead|head of|director|vp|vice president|chief)\b/.test(t)) return 'lead';
    if (/\b(senior|sr\.?|sr\b|architect)\b/.test(t)) return 'senior';
    if (/\b(mid|intermediate)\b/.test(t)) return 'mid';
    if (/\b(junior|jr\.?|entry|intern)\b/.test(t)) return 'entry';
    // Title doesn't reveal a level — stay conservative.
    return 'mid';
  }
  if (years <= 2) return 'entry';
  if (years <= 5) return 'mid';
  if (years <= 10) return 'senior';
  if (years <= 15) return 'lead';
  return 'executive';
}

/**
 * Normalize and tokenize a text string for matching.
 */
function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, ' ').split(/\s+/).filter(t => t.length > 1);
}

/**
 * Check if a candidate's location overlaps with a job's location.
 * Handles city/state/country matching and remote preferences.
 */
function scoreLocation(profileLocation, jobLocation, jobLocationType) {
  if (!profileLocation || !jobLocation) return 0;
  
  // Remote jobs match everyone
  if (jobLocationType === 'remote') return 1.0;
  
  const pLoc = profileLocation.toLowerCase().trim();
  const jLoc = jobLocation.toLowerCase().trim();
  
  // Exact match
  if (jLoc.includes(pLoc) || pLoc.includes(jLoc)) return 1.0;
  
  // Extract city and state
  const pParts = pLoc.split(/[,\s]+/).map(p => p.trim()).filter(Boolean);
  const jParts = jLoc.split(/[,\s]+/).map(p => p.trim()).filter(Boolean);
  
  // Check if any significant parts match (city or state)
  const overlap = pParts.filter(p => p.length > 1 && jParts.some(j => j === p || j.includes(p) || p.includes(j)));
  if (overlap.length > 0) return 0.7;
  
  // Same country check (US, USA, United States, etc.)
  const usVariants = ['us', 'usa', 'united states'];
  const pIsUS = pParts.some(p => usVariants.includes(p)) || /\b[A-Z]{2}\b/.test(profileLocation);
  const jIsUS = jParts.some(p => usVariants.includes(p)) || jLoc.includes('united states');
  if (pIsUS && jIsUS) return 0.2;
  
  return 0;
}

/**
 * Score a single job against a candidate profile.
 * Returns 0-100 relevance score.
 * 
 * Scoring weights:
 *   - Title/role match: 30 points
 *   - Skills match: 35 points
 *   - Experience level match: 15 points
 *   - Location match: 15 points
 *   - Recency bonus: 5 points
 */
function scoreJob(job, profileData) {
  const { candidateSkills, experienceTitles, experienceKeywords, profileLocation, yearsExp, expLevel, profileTitle } = profileData;
  
  let score = 0;
  const matchDetails = {
    matchedSkills: [],
    missingSkills: [],
    titleMatch: 0,
    skillsMatch: 0,
    experienceMatch: 0,
    locationMatch: 0,
    recencyBonus: 0,
  };
  
  // --- 1. Title/Role Match (0-45 pts) — THE DOMINANT SIGNAL ---
  // Title is intentionally the single most important factor: a job whose
  // title matches the candidate's role is relevant even when the JD vocab
  // doesn't surface every listed skill, and — crucially — a job with a
  // mismatched title (e.g. a "Solutions Engineer" or "Designer" role for a
  // "Frontend Engineer") must NOT rank highly just because it shares generic
  // keywords like git/rest/api. Skills are the secondary signal below.
  const jobTitleTokens = tokenize(job.title);
  const jobTitleLower = (job.title || '').toLowerCase();

  let titleScore = 0;

  // Compare with profile title (0-22)
  if (profileTitle) {
    const profileTitleTokens = tokenize(profileTitle);
    const titleOverlap = profileTitleTokens.filter(t => jobTitleTokens.includes(t) || jobTitleLower.includes(t));
    titleScore += Math.min(22, (titleOverlap.length / Math.max(profileTitleTokens.length, 1)) * 22);
  }

  // Compare with experience titles (0-23) — take the best-matching past role
  if (experienceTitles.length > 0) {
    let bestTitleMatch = 0;
    for (const expTitle of experienceTitles) {
      const expTokens = tokenize(expTitle);
      const overlap = expTokens.filter(t => jobTitleTokens.includes(t) || jobTitleLower.includes(t));
      const matchRatio = overlap.length / Math.max(expTokens.length, 1);
      bestTitleMatch = Math.max(bestTitleMatch, matchRatio);
    }
    titleScore += bestTitleMatch * 23;
  }
  titleScore = Math.min(45, titleScore);
  score += titleScore;
  matchDetails.titleMatch = Math.round(titleScore);

  // --- 2. Skills Match (0-30 pts) — secondary to title ---
  const jobText = [
    job.title || '',
    job.description || '',
    job.department || '',
    job.requirements || '',
    ...(Array.isArray(job.skills) ? job.skills : [])
  ].join(' ').toLowerCase();
  
  let skillScore = 0;
  if (candidateSkills.length > 0) {
    for (const skill of candidateSkills) {
      const skillRegex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.?js)?\\b`, 'i');
      if (skillRegex.test(jobText) || jobText.includes(skill)) {
        matchDetails.matchedSkills.push(skill);
      }
    }
    // Calibrate to a "reasonable" core-skill count so skill-rich profiles
    // (which mine 30+ skills from their experience) aren't unfairly penalised.
    // A job description that mentions 6+ of the candidate's skills is a strong
    // skills match and should clear the full skills allotment.
    const denom = Math.min(candidateSkills.length, 6);
    const matchRatio = Math.min(1, matchDetails.matchedSkills.length / denom);
    skillScore = Math.min(30, matchRatio * 30);
  }

  // Extract job-required skills that are missing from the profile
  // Parse skills from job description
  const jobSkillsList = Array.isArray(job.skills) ? job.skills.map(s => s.toLowerCase()) : [];
  for (const jSkill of jobSkillsList) {
    if (!candidateSkills.some(cs => jSkill.includes(cs) || cs.includes(jSkill))) {
      matchDetails.missingSkills.push(jSkill);
    }
  }

  score += skillScore;
  matchDetails.skillsMatch = Math.round(skillScore);

  // Synergy bonus — when the role *type* is right (strong title overlap)
  // and we're matching the candidate's location, that's already a high-
  // signal fit even if the JD vocabulary doesn't surface every skill the
  // profile lists. Without this, sparse profiles (especially senior ones
  // where skills live in experience descriptions, not a labelled array)
  // cap around 70-75% and never clear realistic thresholds. We only
  // award this when both signals are strong, so it can't lift weak
  // matches.
  if (matchDetails.titleMatch >= 28 && matchDetails.locationMatch >= 12) {
    matchDetails.synergyBonus = 10;
    score += 10;
  } else {
    matchDetails.synergyBonus = 0;
  }
  
  // --- 3. Experience Level Match (0-15 pts) ---
  let expScore = 0;
  if (job.experienceLevel && expLevel) {
    const levels = ['entry', 'mid', 'senior', 'lead', 'executive'];
    const jobLevelIdx = levels.indexOf(job.experienceLevel);
    const candidateLevelIdx = levels.indexOf(expLevel);
    
    if (jobLevelIdx >= 0 && candidateLevelIdx >= 0) {
      const diff = Math.abs(jobLevelIdx - candidateLevelIdx);
      if (diff === 0) expScore = 15;
      else if (diff === 1) expScore = 10;
      else if (diff === 2) expScore = 4;
    }
  } else {
    expScore = 5;
  }
  score += expScore;
  matchDetails.experienceMatch = expScore;
  
  // --- 4. Location Match (0-15 pts) ---
  const locScore = scoreLocation(profileLocation, job.location, job.locationType);
  score += locScore * 15;
  matchDetails.locationMatch = Math.round(locScore * 15);
  
  // --- 5. Recency Bonus (0-5 pts) ---
  // Use COALESCE(postedAt, createdAt) so Greenhouse jobs (which intentionally
  // store postedAt = NULL — see normalizeGreenhouseJob) still get a recency
  // signal from when we first saw them.
  const recencyAnchor = job.postedAt || job.createdAt;
  if (recencyAnchor) {
    const daysAgo = (Date.now() - new Date(recencyAnchor).getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo <= 1) matchDetails.recencyBonus = 5;
    else if (daysAgo <= 3) matchDetails.recencyBonus = 4;
    else if (daysAgo <= 7) matchDetails.recencyBonus = 3;
    else if (daysAgo <= 14) matchDetails.recencyBonus = 2;
    else if (daysAgo <= 30) matchDetails.recencyBonus = 1;
    score += matchDetails.recencyBonus;
  }

  // --- Title relevance gate ---
  // Title is the dominant signal, so a job with essentially NO title/role
  // overlap with the candidate must not rank as a strong match purely on
  // shared generic keywords (git, rest, api, etc.). When the title barely
  // matches, cap the ceiling so these roles fall below realistic relevance
  // thresholds (and out of the daily digest / top of search) instead of
  // landing in the 80s off skill keyword spam alone.
  let gatedScore = score;
  const haveTitleSignal = !!profileTitle || (experienceTitles && experienceTitles.length > 0);
  if (haveTitleSignal) {
    if (matchDetails.titleMatch <= 4) {
      // No meaningful role-type overlap → hard cap.
      gatedScore = Math.min(gatedScore, 38);
    } else if (matchDetails.titleMatch <= 10) {
      // Weak/partial role overlap → moderate cap.
      gatedScore = Math.min(gatedScore, 62);
    }
  }

  const finalScore = Math.round(Math.min(100, Math.max(0, gatedScore)));

  // Separate ranking score that multiplies match by a recency factor so
  // fresh-and-relevant jobs sort above stale-but-relevant. Mirrors the SQL
  // path in jobEmbeddingService.searchSimilarJobs. The displayed `score`
  // (relevanceScore) keeps its meaning as pure profile match.
  //   0 days:  factor = 1.00
  //   3 days:  factor ≈ 0.89
  //   7 days:  factor = 0.75
  //  14+ days: factor = 0.50 (floor)
  let recencyFactor = 1.0;
  if (recencyAnchor) {
    const daysAgo = (Date.now() - new Date(recencyAnchor).getTime()) / (1000 * 60 * 60 * 24);
    recencyFactor = Math.max(0.5, 1.0 - Math.min(daysAgo, 14) / 28);
  } else {
    // Unknown recency: treat as ~7-day-old so unknowns lose ground.
    recencyFactor = 0.75;
  }
  const rankScore = finalScore * recencyFactor;

  return { score: finalScore, matchDetails, rankScore };
}

/**
 * Score and rank a list of jobs against a candidate profile.
 * Returns jobs with `relevanceScore` attached, sorted by score DESC then postedAt DESC.
 */
function rankJobs(jobs, profile, { sortMode = 'recommended' } = {}) {
  // No profile (e.g. a freshly-registered user who hasn't built one yet):
  // return jobs unranked. Convert Sequelize instances to plain objects first
  // — spreading a model instance copies internal circular refs (include/
  // parent), which makes res.json() throw "Converting circular structure to
  // JSON" and 500s the whole jobs page.
  if (!profile) return jobs.map(j => ({ ...(j.toJSON ? j.toJSON() : j), relevanceScore: 0 }));
  
  // Pre-compute profile data once
  const candidateSkills = extractSkills(profile);
  const { titles: experienceTitles, keywords: experienceKeywords } = extractExperienceKeywords(profile);
  const profileLocation = profile.location || '';
  const yearsExp = computeYearsOfExperience(profile);
  const profileTitle = (profile.title || profile.headline || '').toLowerCase();
  const expLevel = inferExperienceLevel(yearsExp, profileTitle);
  
  const profileData = { candidateSkills, experienceTitles, experienceKeywords, profileLocation, yearsExp, expLevel, profileTitle };
  
  const scored = jobs.map(job => {
    const jobPlain = job.toJSON ? job.toJSON() : job;
    const { score, rankScore, matchDetails } = scoreJob(jobPlain, profileData);
    return {
      ...jobPlain,
      relevanceScore: score,
      // Surface the actual skills that matched so the card can show users
      // WHY this job ranked highly. matchDetails.matchedSkills is the
      // intersection of profile skills × job text/skills.
      matchedSkills: Array.isArray(matchDetails?.matchedSkills) ? matchDetails.matchedSkills : [],
      // Title/role overlap component (0-45). Exposed so callers (e.g. the
      // daily digest) can enforce a hard title floor — title is the primary
      // relevance signal.
      titleMatch: matchDetails?.titleMatch || 0,
      // Recency-weighted rank score used for ordering only — not exposed to
      // the UI. Keeps relevanceScore meaning "% profile match" while the
      // top of the list still favors fresh content.
      _rankScore: rankScore != null ? rankScore : score
    };
  });

  // Sort by mode:
  //   recommended → latest posted first, match score tiebreak
  //   match       → pure match, recency tiebreak
  //   recent      → recency first, match tiebreak
  // Recommended sorts strictly newest-first (same as recent) while still
  // carrying each job's match % badge — product decision is "recommended =
  // latest first". Jobs are already personalized candidates here.
  scored.sort((a, b) => {
    const ra = a.postedAt || a.createdAt || 0;
    const rb = b.postedAt || b.createdAt || 0;
    const recDiff = new Date(rb) - new Date(ra);
    if (sortMode === 'match') {
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      return recDiff;
    }
    // recommended + recent: recency first, match score tiebreak.
    if (recDiff !== 0) return recDiff;
    return b.relevanceScore - a.relevanceScore;
  });

  // Strip the internal sort key before returning so it doesn't leak into
  // API responses.
  return scored.map(({ _rankScore, ...rest }) => rest);
}

/**
 * Build the pre-computed profile scoring data once per user, so callers
 * scoring many jobs in a row don't repeat the extraction work for every
 * call to `scoreJob`. Mirrors what `rankJobs` does internally.
 */
function buildProfileScoringData(profile) {
  if (!profile) {
    return {
      candidateSkills: [],
      experienceTitles: [],
      experienceKeywords: [],
      profileLocation: '',
      yearsExp: 0,
      expLevel: 'entry',
      profileTitle: '',
    };
  }
  const candidateSkills = extractSkills(profile);
  const { titles: experienceTitles, keywords: experienceKeywords } = extractExperienceKeywords(profile);
  const profileLocation = profile.location || '';
  const yearsExp = computeYearsOfExperience(profile);
  const profileTitle = (profile.title || profile.headline || '').toLowerCase();
  const expLevel = inferExperienceLevel(yearsExp, profileTitle);
  return {
    candidateSkills,
    experienceTitles,
    experienceKeywords,
    profileLocation,
    yearsExp,
    expLevel,
    profileTitle,
  };
}

module.exports = {
  scoreJob,
  rankJobs,
  extractSkills,
  extractExperienceKeywords,
  computeYearsOfExperience,
  inferExperienceLevel,
  buildProfileScoringData,
};
