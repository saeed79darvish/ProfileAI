/**
 * Job Match Reading Prompt
 *
 * Deliberately does NOT ask for a match percentage. Models asked "how well does
 * this candidate match, 0-100?" cluster everything at 70-85 regardless of input.
 * Asked instead to extract each requirement and cite the evidence that covers
 * it, they answer honestly — and the arithmetic then happens in jobMatchScore.js.
 */

const JOB_MATCH_SYSTEM =
  'You are a technical recruiter doing a first-pass screen. You read a job posting and a ' +
  'candidate profile and report exactly what the posting requires and exactly which of those ' +
  'requirements the candidate can evidence. You never credit a requirement the candidate ' +
  'cannot demonstrate, and you never invent evidence. Return valid JSON only.';

function buildJobMatchPrompt({ jobTitle, jobDescription, profile }) {
  const skills = Array.isArray(profile.skills)
    ? profile.skills.map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean).join(', ')
    : profile.skills && typeof profile.skills === 'object'
      ? Object.entries(profile.skills)
          .map(([cat, items]) => `${cat}: ${Array.isArray(items) ? items.join(', ') : ''}`)
          .join('; ')
      : '';

  // Experience is the evidence base for the whole score, so it goes in far more
  // fully than the old keyword prompt allowed (it truncated each role to 200
  // chars, which threw away the very bullets that prove a requirement).
  const experience = (profile.experience || [])
    .map((e, i) => {
      const period = [e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' to ');
      return `[${i + 1}] ${e.title || 'Role'} at ${e.company || 'Unknown'}${period ? ` (${period})` : ''}\n${(e.description || '').slice(0, 1200)}`;
    })
    .join('\n\n');

  const education = (profile.education || [])
    .map((e) => [e.degree, e.field, e.school, e.year].filter(Boolean).join(', '))
    .join('; ');

  const projects = (profile.projects || [])
    .map((p) => `${p.title || 'Project'}: ${(p.description || '').slice(0, 300)}`)
    .join('; ');

  const prompt = `Screen this candidate against this job posting.

═══ JOB POSTING ═══
${jobTitle ? `Title: ${jobTitle}\n` : ''}${jobDescription.slice(0, 12000)}

═══ CANDIDATE ═══
Current title: ${profile.title || profile.headline || 'Not stated'}
Summary: ${(profile.summary || '').slice(0, 800)}
Skills: ${skills || 'None listed'}
Education: ${education || 'Not stated'}
Projects: ${projects || 'None listed'}

Experience (newest first):
${experience || 'None listed'}

═══ STEP 1: EXTRACT REQUIREMENTS ═══
Pull every concrete requirement the posting states. A requirement is something a
screener could check. Ignore company boilerplate, mission statements, benefits,
and EEO language — those contain words, not requirements.

For each, set:
- "requirement": the requirement in the posting's own terms, under 60 characters
- "type": one of
    skill             — a named technology, tool, method, or discipline
    experience_years  — a stated minimum ("5+ years in backend")
    credential        — certification, license, clearance
    education         — a required degree or field of study
    title             — the role/track itself ("has worked as a product manager")
    domain            — industry or business context (fintech, healthcare)
    soft              — communication, collaboration, ownership, and similar
    responsibility    — a duty of the job rather than a bar to clear
                        ("participate in on-call rotations", "mentor juniors",
                        "attend design reviews"). If the posting is describing
                        what the person WILL DO rather than what they must
                        ALREADY HAVE, it is a responsibility. These are scored
                        at zero, so classifying them correctly matters.
- "hardness": "must" if the posting states it as required, uses "must have",
  gives a years minimum, or lists it under Requirements / Basic Qualifications.
  "nice" if it appears under Preferred / Nice to have / Bonus / "a plus".
  When the posting is ambiguous, judge by whether the role is doable without it.

═══ STEP 2: FIND EVIDENCE ═══
For each requirement, search the candidate's experience, skills, education and
projects for proof. Set "coverage":
- "strong"  — it is in a job title, or demonstrated in a role from the last ~4
              years with specifics that would survive an interview question
- "partial" — it appears in the skills list only, or only in a role that ended
              more than ~5 years ago, or is adjacent rather than the real thing
- "none"    — no support in the profile

Rules:
- "evidence" must quote or name WHERE it came from ("[2] Senior UI Engineer at
  Autodesk — rebuilt the design system"). Coverage above "none" with no citation
  is invalid; downgrade it to "none".
- The candidate having a related-but-different skill is "partial", not "strong".
- Never count the posting's own wording as evidence.
- Set "hasRelatedEvidence": true when coverage is "none" but the profile shows
  genuinely adjacent work that a rewrite could legitimately surface. False when
  the candidate simply does not have it. Be strict: this flag decides whether we
  promise the user that tailoring can close the gap.
- For a "must" requirement with coverage "none", write "whyBlocking": one plain
  sentence on why a screen would reject on it.

═══ STEP 3: JUDGE THE FIT DIMENSIONS ═══
- "roleFit" (0-1): is this the same job family and track as the candidate's
  career? 1.0 = same role, same discipline. 0.7 = adjacent role in the same
  discipline (backend engineer applying to platform engineer). 0.4 = same
  industry, different function (engineer applying to technical program manager).
  0.1 = different function entirely (engineer applying to a marketing or sales
  role). Judge the WORK, not the vocabulary overlap. Be decisive: this is the
  dimension that stops an unqualified application from scoring respectably.
- "seniorityFit" (0-1): candidate's years and level against what the posting
  asks. 1.0 = squarely in range. 0.5 = one level off in either direction.
  0.2 = two or more levels off. Over-qualification is a real mismatch, not a
  bonus — score it down. This is a FALLBACK: when the posting states a years
  minimum and the profile carries dates, the scorer computes this from the
  numbers and ignores what you put here.
- "recency" (0-1): how current the matched skills are. 1.0 = the core matched
  skills are in the current role. 0.3 = the match rests on work from 6+ years ago.
- "verdict": one sentence a person would actually say about this application,
  naming the single biggest reason for the score.

Return ONLY valid JSON:
{
  "jobTitle": "title as stated in the posting",
  "requirements": [
    {
      "requirement": "5+ years building distributed backend systems",
      "type": "experience_years",
      "hardness": "must",
      "coverage": "strong",
      "evidence": "[1] Staff Engineer at Acme — 6 years on the payments platform",
      "hasRelatedEvidence": false,
      "whyBlocking": ""
    }
  ],
  "roleFit": 0.9,
  "seniorityFit": 1.0,
  "recency": 0.9,
  "verdict": "One sentence naming the biggest driver of this result."
}`;

  return { system: JOB_MATCH_SYSTEM, prompt };
}

module.exports = { buildJobMatchPrompt, JOB_MATCH_SYSTEM };
