/**
 * coverLetterService · shared cover-letter + screener-answer generator.
 *
 * This is the single source of truth for cover letter prompts across:
 *   - /api/profiles/generate-cover-letter (Chrome Extension + Jobs page)
 *   - ApplyPilot auto-apply flow (backend/services/applyPilotService.js)
 *
 * Exports:
 *   generateCoverLetter({ profile, job, tone, lines, memory })
 *     → string (the letter)
 *   generateCoverLetterAndAnswers({ profile, job, memory, formFields, tone, lines })
 *     → { coverLetter: string, answers: [{ fieldId, question, answer, confidence }] }
 *
 * Both functions share the same underlying prompt for the letter itself —
 * generateCoverLetterAndAnswers calls generateCoverLetter internally and
 * then makes a second call for screener answers.
 */
const { callAI, safeParseJSON } = require('./ai/core');
const {
  bannedTerms,
  scrubBannedLanguage,
  findBannedLanguage,
} = require('./resume/writingRules');
const { numberTokens } = require('./resume/draftAudit');

const TONE_INSTRUCTIONS = {
  professional: 'Polished and respectful. Warm but not casual. Use complete sentences and a courteous tone throughout. Open and close with politeness without slipping into corporate jargon.',
  conversational: 'Natural and warm — like a thoughtful person writing to someone they respect. Friendly, not stiff. Polite without being formal. Use "I would" and "I am" rather than "I\'d" and "I\'m" to keep it slightly elevated. No slang.',
  enthusiastic: 'Warm and engaged. Show genuine interest in the role and company without buzzwords. Polite throughout. Avoid exclamation points.',
};

const ANGLES = [
  'Open by anchoring on ONE concrete thing in the JOB description (a system, product, or requirement) and connect it to ONE specific thing the candidate has actually built. No generic "I am excited" energy.',
  'Open by quoting back something specific the JOB description asks for, then immediately pivot to the most relevant thing in the candidate experience — same sentence or next.',
  'Open with a one-line "what I do" framing that maps directly to the role title, then go into the strongest matching story.',
  'Open with a short hook tied to the company name AND a piece of their domain (from the description), then bridge into a relevant candidate story.',
  'Open by naming the role and quietly demonstrating you read the JD — call out the specific stack, scale, or problem space. Then move into a candidate story.',
];

// Per-call creative directives that change the rhythm of the letter so
// regenerations don't converge to the same wording.
const CREATIVE_DIRECTIVES = [
  'Lead the first body paragraph with the OUTCOME (what changed because of you), then back into the work.',
  'Lead the first body paragraph with the PROBLEM, then what you tried, then what stuck.',
  'Lead the first body paragraph with a specific TECHNICAL CHOICE you made and why.',
  'Lead the first body paragraph with how the WORK FELT day-to-day (matter-of-fact, not poetic).',
  'Lead the first body paragraph with a SHORT SCENE: a moment, a deadline, a meeting.',
];

const STORY_PAIRS = [
  ['most recent role', 'an earlier role'],
  ['the role most relevant to this JD', 'a role that shows breadth'],
  ['a role where you led', 'a role where you shipped solo or in a small team'],
  ['a role with the strongest tech overlap', 'a role with the strongest domain or scale overlap'],
];

const CLOSINGS = ['Best,', 'Thanks,', 'Regards,', 'Sincerely,'];

// Closing-line options. Warm but not corporate. The model picks one and
// adapts it to the role/company. We rotate so two regenerations don't end
// the same way.
const CLOSING_LINES = [
  'Would love to talk more about [a specific JD detail] if you are open to it.',
  'I would enjoy a quick call to walk through the work, if that would be helpful.',
  'Would be great to compare notes on [a specific JD detail] when you have time.',
  'Glad to share more detail on the work if it would be useful.',
  'Thanks for taking a look. I would welcome the chance to talk about [a specific JD detail].',
  'I would be glad to dig into [a specific JD detail] with you whenever works.',
];

function summarizeProfile(profile) {
  if (!profile) return { name: 'the candidate', skills: '', experience: '', mostRecentRole: '' };
  const p = profile.toJSON ? profile.toJSON() : profile;
  const name = `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.name || 'the candidate';
  const skills = Array.isArray(p.skills)
    ? p.skills.join(', ')
    : typeof p.skills === 'object' && p.skills
      ? Object.values(p.skills).flat().join(', ')
      : p.skills || '';

  // Shuffle experience so each generation pulls different stories.
  const allExperience = Array.isArray(p.experience) ? [...p.experience] : [];
  const mostRecent = allExperience[0] || null;
  const rest = allExperience.slice(1);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  // Each call picks a different secondary role when the candidate has 3+ jobs,
  // so the second body paragraph isn't always the same role.
  const secondary = rest.length > 0 ? rest[0] : null;
  const selected = mostRecent ? [mostRecent, ...(secondary ? [secondary] : [])] : [];
  // Keep ALL experience available too so the model can pick the most relevant
  // role for the JD, not just whatever happens to be first in the list.
  const fullList = allExperience.length > 0
    ? JSON.stringify(allExperience).substring(0, 2400)
    : '';
  const experience = selected.length > 0
    ? JSON.stringify(selected).substring(0, 1200)
    : '';
  const mostRecentRole = mostRecent
    ? `${mostRecent.title || ''} at ${mostRecent.company || ''}`.trim()
    : '';

  // The untruncated text of everything the candidate actually wrote. `fullList`
  // is capped at 2400 characters for the prompt's sake; a number check run
  // against a truncated source would call the candidate's own figures invented,
  // which is the one way this check could do harm.
  const sourceText = [
    p.summary || p.bio || '',
    p.headline || '',
    JSON.stringify(allExperience),
    JSON.stringify(p.education || []),
    JSON.stringify(p.projects || []),
    JSON.stringify(p.certifications || []),
    skills,
  ].join('\n');

  return { name, skills: skills.substring(0, 300), experience, fullList, mostRecentRole, sourceText };
}

function summarizeJob(job) {
  if (!job) return { title: 'the role', company: 'the company', description: '', requirements: '' };
  const j = job.toJSON ? job.toJSON() : job;
  // Bump description budget to 3000 chars + include `requirements`
  // separately so the cover letter can actually reference what the
  // role asks for (the old 1500 chars was often empty after the
  // header copy was stripped).
  return {
    title: j.title || j.jobTitle || 'the role',
    company: j.company || j.companyName || 'the company',
    description: String(j.description || j.jobDescription || '').substring(0, 3000),
    requirements: String(j.requirements || '').substring(0, 1500),
  };
}

function buildLetterPrompt({ profile, job, tone = 'conversational', lines = 8, length, memory = [] }) {
  // Word-count targets. Deliberately tighter than the UI labels because
  // models tend to overshoot — aiming low lands closer to the user's
  // expectation. Short ~110, Medium ~190, Long ~300.
  const WORD_TARGETS = { short: 110, medium: 190, long: 300 };
  const wordTarget = (typeof length === 'string' && WORD_TARGETS[length]) ? WORD_TARGETS[length] : null;
  const lineCount = Math.min(28, Math.max(4, parseInt(lines, 10) || 8));
  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.conversational;
  const isShort = wordTarget ? wordTarget <= 130 : lineCount <= 9;
  const isLong = wordTarget ? wordTarget >= 260 : lineCount >= 18;
  const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];
  const directive = CREATIVE_DIRECTIVES[Math.floor(Math.random() * CREATIVE_DIRECTIVES.length)];
  const storyPair = STORY_PAIRS[Math.floor(Math.random() * STORY_PAIRS.length)];
  const closing = CLOSINGS[Math.floor(Math.random() * CLOSINGS.length)];
  const closingLine = CLOSING_LINES[Math.floor(Math.random() * CLOSING_LINES.length)];
  const seed = Math.random().toString(36).slice(2, 10);

  const p = summarizeProfile(profile);
  const j = summarizeJob(job);

  const lengthLine = wordTarget
    ? `HARD WORD LIMIT: ${wordTarget} words MAX (count silently). Going over the limit is a failure.`
    : `Target length: about ${lineCount} lines of body text.`;

  const structureBlock = isShort
    ? `STRUCTURE (short — must fit in ${wordTarget || 110} words total):
- ${lengthLine}
- Opening: ONE short sentence. Name the role + company AND nod to one specific thing in the JD.
- Body: ONE story (2-3 sentences) about ONE thing you actually did that maps to the JD. Pull it from ${storyPair[0]}.
- Closing: ONE short sentence.
That is the WHOLE letter. No second paragraph. No "I also" anything. If you've written 110 words and aren't done, stop and rewrite shorter.`
    : `STRUCTURE (${isLong ? 'long' : 'medium'}):
- ${lengthLine}
- Opening: ONE sentence. Role + company + nod to one specific JD detail.
- Paragraph 1: ONE story from ${storyPair[0]}. ${isLong ? '3-5' : '2-4'} sentences about ONE thing.
- Paragraph 2: ONE story from ${storyPair[1]}. ${isLong ? '3-5' : '2-4'} sentences about ONE different thing.
- Closing: ONE short sentence.`;

  const memoryBlock = memory && memory.length
    ? `\nCANDIDATE VOICE (quote verbatim when they fit):\n${memory.map((m) => `- ${m.key}: ${m.value}`).join('\n')}\n`
    : '';

  return {
    prompt: `You are writing a short professional EMAIL to a hiring manager. Not a "cover letter". An email. Tight, direct, like you'd actually send.

SEED: ${seed}  (Do not repeat phrasing from any previous attempt. Different verbs, different opening, different rhythm.)

HOW A REAL HUMAN WRITES THIS (study the VOICE — do not copy any content; placeholders are deliberately fake):
"""
Dear Hiring Manager,

The [ROLE] role at [COMPANY] stood out to me, in particular the part about [ONE SPECIFIC JD DETAIL]. That has been a big focus of my work over the last [TIMEFRAME].

At [PRIOR COMPANY] I built [ONE THING]. We had [ONE CONCRETE PROBLEM], and the fix ended up being [ONE CONCRETE CHOICE]. It worked well, and [ONE QUIET RESULT].

[ONE-LINE COURTEOUS CLOSER tied to the role or a specific JD detail].

Best,
[Name]
"""

Notice what that example does NOT do:
- It does NOT open with "I architect X that enable Y" — that is a LinkedIn headline, not an email.
- It does NOT open with "Saw the role" or "Most days at X involved" — those read as too casual or abrupt.
- It does NOT say "which aligns with", "would welcome the opportunity", "platform engineering experience can contribute".
- It does NOT use "across", "achieved", "established", "leveraging", "robust", "scalable".
- It does NOT have a closing paragraph that summarizes your value prop.
- It does NOT close with "Happy to chat if useful" or "Let me know if there is a fit" — too blunt. Use the CLOSING LINE provided below.

CANDIDATE:
- Name: ${p.name}
- Most Recent Role: ${p.mostRecentRole}
- Stories to mine first: ${p.experience}
- Full experience (pick the role most relevant to THIS JD): ${p.fullList}
- Skills: ${p.skills}
${memoryBlock}
JOB:
- Role: ${j.title}
- Company: ${j.company}
- Description: ${j.description}
- Requirements: ${j.requirements}

${structureBlock}

CORE PURPOSE OF THIS LETTER:
Show the hiring manager (a) that the candidate's specific skills MATCH what this job needs, and (b) how the candidate would help THIS team reach the goals stated or implied in the JD. Every sentence in the body should serve one of those two purposes. Do not list achievements that are not relevant to this JD.

OPENING ANGLE: ${angle}
CREATIVE DIRECTIVE: ${directive}
CLOSING LINE TEMPLATE: ${closingLine}  (Use THIS as your final line before the sign-off. Replace any [bracket] with a concrete JD detail. Do not use any other closer.)
TONE: ${toneInstruction}

VOICE RULES:
1. NEVER open with a self-summary like "I [verb] X that [verb] Y" or "I am a [role] with experience in X". The opening is anchored to the JOB, not to you.
2. Say what you DID. Never "taught me", "showed me", "helped me understand", "gave me insight into".
3. Never explain why something was hard, important, valuable, key, or worth doing. Just say what happened.
4. Never describe your own actions with adjectives like "challenging", "rewarding", "tricky", "messy", "harder than expected", "complex". Cut all meta-commentary.
5. NO PERCENTAGES. NO IMPROVEMENT METRICS. Do NOT write "40%", "25%", "reduced by X%", "increased by X%", "dropped by X%", "jumped X%", "boosted X%", "cut X%". These are the #1 AI tell in cover letters. Talk about what you BUILT and what CHANGED qualitatively ("teams adopted it quickly", "the rollout went smoothly", "the build broke less often"). Concrete counts of things you shipped (e.g. "15 components", "3 services") are fine if they appear in the profile. Performance percentages are NOT.
6. ONE technology name per sentence max.
7. Short sentences. Vary length. The AI tell is the "did X across Y teams achieving Z%" pattern. Break those into two short sentences and drop the percentage entirely.
8. Do NOT parrot JD phrasing.
9. No em/en dashes. Periods and commas only.
10. Do NOT start with "I'm writing", "I saw the", "I'm applying", "I'm excited", "I came across", "I'm interested in", "I noticed", "I architect", "I build", "I lead", "I design", "I am a", "My name is", "Most days at", "Saw the", "Most days involved".
11. The closing sentence must follow this template, adapted to THIS specific JD: "${closingLine}" — replace any [bracket] with a real, concrete detail from the JOB section above. Keep it ONE short line. Do NOT use "Happy to chat if useful", "Happy to talk", "Looking forward", "I would welcome", "I look forward to discussing", "I'm available to chat".
12. End with "${closing}" then "${p.name}". Nothing after.
13. Do NOT invent numbers. If the candidate profile does not state a number, do not put one in the letter. AND even if a percentage IS in the profile, do not use it in the letter — describe the change qualitatively instead.
14. POLITENESS: keep the tone warm and respectful throughout. The opening should acknowledge the role courteously. The closing should thank the reader or invite a conversation politely. Avoid blunt or overly casual phrasing like "Saw the post", "Hit me up", "Let me know if there is a fit". A real human writing to a hiring manager is friendly but considerate.

BANNED — THE SHARED RESUME LIST APPLIES HERE TOO (all grammatical forms):
${bannedTerms().join(', ')}
Self-ratings included: never "expert in", "highly skilled", "exceptional" or
"extensive experience". A letter shows the level by describing the work.

BANNED — LETTER-SPECIFIC (do not use, even paraphrased):
"resonates", "translate well", "caught my attention", "caught my eye", "excites me", "reminds me of",
"challenging but rewarding", "I'm confident", "I believe", "from day one", "align with",
"aligns with", "passionate about", "thrilled", "eager to", "uniquely positioned",
"extensive experience", "proven track record", "mission-driven", "the opportunity to",
"particularly drawn", "high-stakes", "cross-functional", "leveraging", "utilizing",
"spearheaded", "orchestrated", "comprehensive", "robust", "enterprise-grade", "cutting-edge",
"could be useful", "well-positioned", "stands out", "track record of", "taught me",
"showed me", "helped me understand", "gave me insight", "importance of", "at scale",
"would be valuable", "the experience", "which demonstrated", "this role requires",
"I also", "Additionally", "Furthermore", "Moreover",
"I'm writing about", "I'm writing to apply", "I'm interested in",
"would be a good fit", "would be a great fit", "I think this",
"establishing clear", "buy-in", "developer adoption", "harder than the technical work",
"the tricky part was", "messier than expected", "rolling their own",
"figuring out why", "back at", "most days involved", "I'd like to help",
"exactly what I", "is exactly what",
"I architect", "platforms that enable", "ship faster", "more consistently",
"would welcome the opportunity", "look forward to discussing",
"can contribute to", "platform engineering experience",
"established coding standards", "achieved 99", "across [0-9]+ teams",
"reduced development time", "automated testing and documentation",
"reusable TypeScript components", "enable engineering teams",
"my [a-z]+ experience", "scalable", "seamless", "best practices",
"happy to chat", "happy to talk", "looking forward", "available to chat",
"if useful", "if it is useful", "if it's useful"

OUTPUT FORMAT:
Start with "Dear Hiring Manager,". Then a blank line. Then the body. Then "${closing}" on its own line. Then "${p.name}" on its own line. Nothing else.`,
    maxTokens: wordTarget ? Math.round(wordTarget * 1.8) + 60 : Math.round(lineCount * 22) + 60,
    // Carried out so the enforcement pass diffs against the same profile the
    // letter was written from, rather than re-deriving it and drifting.
    sourceText: p.sourceText,
  };
}

/**
 * Every digit-run in a text. Digits only, deliberately: "two years" is ordinary
 * English in a letter, and dropping a sentence for spelling a small number
 * would cost more than it saves. What is being hunted is the fabricated
 * measurement, and those arrive as digits.
 */
function digitTokens(text) {
  return (String(text || '').replace(/,(?=\d{3}\b)/g, '').match(/\d+(?:\.\d+)?/g) || []);
}

/**
 * The letter's enforcement pass.
 *
 * The prompt bans a long list of words and tells the model not to invent
 * numbers, and until this existed the only thing checked afterwards was
 * percentages. Everything else was enforced by asking — at temperature 0.95,
 * which is the highest in the product. The resume path learned this lesson
 * three times: a rule the model both applies and grades is not enforced.
 *
 * Line by line, never across the whole string: the scrub joins sentences with
 * spaces, and running it over the letter whole would collapse "Best," and the
 * candidate's name onto one line.
 */
function enforceLetterRules(text, sourceText) {
  const sourceNumbers = numberTokens(sourceText);

  const scrubbed = String(text || '')
    .split('\n')
    .map((line) => (line.trim() ? scrubBannedLanguage(line).text : line))
    .join('\n');

  // Sentences that cannot be repaired by word substitution: a banned phrase
  // that needs the sentence rebuilt, or a number the candidate's profile does
  // not contain. Both are dropped whole, which is the policy percentages
  // already had here — a letter reads fine one sentence shorter, and neither
  // an unfalsifiable boast nor an invented figure can be salvaged in place.
  const dropped = [];
  const out = scrubbed
    .split(/\n{2,}/)
    .map((paragraph) => paragraph
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => {
        if (/\b\d{1,3}\s*%/.test(sentence)) { dropped.push(sentence.trim()); return false; }
        if (findBannedLanguage(sentence).some((h) => !h.fixable)) { dropped.push(sentence.trim()); return false; }
        const invented = digitTokens(sentence).filter((d) => !sourceNumbers.has(d));
        if (invented.length) { dropped.push(sentence.trim()); return false; }
        return true;
      })
      .join(' ')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
    )
    .filter(Boolean)
    .join('\n\n');

  if (dropped.length) {
    console.log(`[ProfilleAI] Cover letter: dropped ${dropped.length} sentence(s) for banned phrasing or an unverifiable number:`, dropped.slice(0, 3));
  }
  return out;
}

function cleanLetter(text) {
  let out = (text || '').replace(/\s*[—–]\s*/g, ', ').trim();

  // If the model returned the whole letter on one line (no paragraph breaks),
  // re-insert paragraph breaks at the obvious boundaries: after the greeting,
  // before the sign-off line, and between body sentences that end one
  // logical block (heuristic: insert a break after the first sentence so the
  // greeting line is on its own).
  if (!/\n/.test(out)) {
    out = out
      // greeting on its own line
      .replace(/^(Dear[^,]*,)\s*/i, '$1\n\n')
      // sign-off (Best, / Thanks, / Regards, / Sincerely,) on its own line
      .replace(/\s+(Best|Thanks|Regards|Sincerely),\s*/i, '\n\n$1,\n');
  }

  // Percentages used to be stripped here, on their own. They are now one of the
  // three things enforceLetterRules drops — alongside banned phrasing and
  // numbers the candidate's profile does not contain — because they were never
  // the only rule this letter was failing, only the only one being checked.
  return out;
}

/**
 * If the model overshoots the word target, drop the second body paragraph
 * (everything between the first blank line after the opener and the closing
 * sign-off block). Last-resort safety net so "short" stays short.
 */
function enforceWordLimit(text, length) {
  const WORD_LIMITS = { short: 140, medium: 230, long: 360 };
  const limit = WORD_LIMITS[length];
  if (!limit) return text;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= limit) return text;

  // Try to drop the second body paragraph first.
  const lines = text.split('\n');
  const blanks = [];
  lines.forEach((l, i) => { if (l.trim() === '') blanks.push(i); });
  // We expect: [Dear...] (blank) [body1] (blank) [body2] (blank) [closing] [name]
  if (blanks.length >= 3) {
    const cut = lines.slice(0, blanks[1]).concat(lines.slice(blanks[2]));
    const candidate = cut.join('\n');
    if (candidate.split(/\s+/).filter(Boolean).length <= limit) return candidate;
  }
  return text;
}

/**
 * Generate a cover letter only.
 * Shared by the profile route and by generateCoverLetterAndAnswers below.
 */
async function generateCoverLetter({ profile, job, tone, lines, length, memory = [] }) {
  const { prompt, maxTokens, sourceText } = buildLetterPrompt({ profile, job, tone, lines, length, memory });
  const res = await callAI({
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.95,
  });
  const raw = res.choices[0].message.content || '';
  return enforceWordLimit(enforceLetterRules(cleanLetter(raw), sourceText), length);
}

/**
 * Generate per-field screener answers.
 * Used by ApplyPilot when the ATS form has short-answer fields.
 */
async function generateScreenerAnswers({ profile, job, memory = [], formFields = [] }) {
  if (!formFields || formFields.length === 0) return [];

  const p = summarizeProfile(profile);
  const j = summarizeJob(job);

  const prompt = `You are answering screener questions for a job application. Use the candidate's voice — quote the memory rows verbatim when they fit.

CANDIDATE:
- Name: ${p.name}
- Most Recent Role: ${p.mostRecentRole}
- Experience: ${p.experience}
- Skills: ${p.skills}

MEMORY (candidate's own words):
${memory.map((m) => `- ${m.key}: ${m.value}`).join('\n') || '(none)'}

JOB:
- Role: ${j.title}
- Company: ${j.company}
- Description: ${j.description}
- Requirements: ${j.requirements}

FORM FIELDS:
${JSON.stringify(formFields, null, 2)}

Return JSON only:
{
  "answers": [
    { "fieldId": "why_us", "question": "Why do you want to work here?",
      "answer": "...", "confidence": 0-100 }
  ]
}

CRITICAL RULES for dropdown / select / radio fields:
- If a field has a non-empty "options" array (e.g. type="select", "radio", "yes_no", "multi_select"), the "answer" MUST be an EXACT VERBATIM copy of one of those option strings. Do NOT paraphrase. Do NOT add extra words. Do NOT explain.
- Example: options=["Yes","No","Prefer not to say"] → answer must be exactly "Yes" (not "Yes, I am authorized" or "yes, definitely").
- For multi-select, return an array of exact option strings.
- If you can't confidently pick from the options, return the option that means "decline / prefer not to say" if available, else set confidence < 60 and pick the closest option.
- For free-text fields (no options), write a concise 1-3 sentence answer.

WRITING RULES for free-text answers (the same ones the resume and the letter follow):
- Never invent anything. Only what the profile and memory state — no skill, no
  project, no number the candidate did not give you. An answer you cannot
  source belongs in the low-confidence path below, not in a confident sentence.
- No numbers the profile does not contain, and no percentages at all.
- Banned words, in every grammatical form: ${bannedTerms().join(', ')}.
  Self-ratings included — never "expert in", "highly skilled", "exceptional".
  Say what the candidate did; let the reader do the rating.
- Plain sentences. No abstract closing clauses ("with a focus on scalability"),
  no three-in-a-row quality nouns, no phrasing copied from the job description.

If a question can't be answered confidently from profile + memory, set confidence < 60 and put a placeholder so the human notices.`;

  const res = await callAI({
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1200,
    temperature: 0.6,
  });
  const raw = res.choices[0].message.content.trim();
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  const parsed = safeParseJSON(json || raw, { answers: [] });
  const answers = parsed.answers || [];

  // Scrub free-text answers only. An answer to a select/radio field must stay a
  // verbatim copy of one of the field's options — rewriting "Yes, utilizing a
  // work visa" into "Yes, using a work visa" would break the exact-match
  // contract above and fail the form submission, so those are left alone and
  // the banned word is the lesser problem.
  const optionFields = new Set(
    (formFields || [])
      .filter((f) => Array.isArray(f.options) && f.options.length > 0)
      .map((f) => f.fieldId || f.id)
  );

  return answers.map((a) => {
    if (typeof a.answer !== 'string' || optionFields.has(a.fieldId)) return a;
    const scrubbed = scrubBannedLanguage(a.answer);
    if (!scrubbed.replaced.length && !scrubbed.residual.length) return a;
    // Residual phrasing needs a writer, and there is no review round on a
    // screener answer — so it lands in front of the human instead, which is
    // what the low-confidence path is for.
    return {
      ...a,
      answer: scrubbed.text,
      confidence: scrubbed.residual.length ? Math.min(Number(a.confidence) || 0, 55) : a.confidence,
    };
  });
}

/**
 * Generate a cover letter AND per-field screener answers.
 * ApplyPilot entry point.
 */
async function generateCoverLetterAndAnswers({ profile, job, memory = [], formFields = [], tone, lines }) {
  const [coverLetter, answers] = await Promise.all([
    generateCoverLetter({ profile, job, tone, lines, memory }),
    generateScreenerAnswers({ profile, job, memory, formFields }),
  ]);
  return { coverLetter, answers };
}

module.exports = {
  generateCoverLetter,
  generateCoverLetterAndAnswers,
  // Exported for the regression harness: the enforcement pass is pure, and it
  // is the half of this service that can be verified without a model call.
  enforceLetterRules,
  cleanLetter,
};
