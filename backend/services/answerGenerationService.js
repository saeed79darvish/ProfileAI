/**
 * Shared AI answer-generation logic for job application screening questions.
 *
 * Extracted from POST /api/profiles/generate-answers (the handler the
 * Chrome extension and web app both call) so a second, differently
 * authenticated front door — the mobile bookmarklet's
 * POST /api/bookmarklet/generate-answers — can reuse the exact same prompt
 * and parsing logic instead of maintaining a second copy. Behavior is
 * unchanged from the original inline handler.
 */
const aiService = require('./aiService');
const { recordAIUsage } = require('../middleware/aiRateLimiter');

class AnswerGenerationValidationError extends Error {}
class AnswerGenerationParseError extends Error {}

/**
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.userFirstName]
 * @param {string} [params.userLastName]
 * @param {string[]} params.questions
 * @param {string} [params.jobDescription]
 * @param {object} [params.profile]
 * @param {object[]} [params.questionMeta]
 * @param {object} [params.seedAnswers]
 * @returns {Promise<{ answers: Record<string, string> }>}
 */
async function generateAnswers({
  userId,
  userFirstName,
  userLastName,
  questions,
  jobDescription,
  profile,
  questionMeta,
  seedAnswers,
}) {
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    throw new AnswerGenerationValidationError('Questions array is required');
  }

  console.log(`Generating AI answers for ${questions.length} questions for user ${userId}`);

  // Build skills string safely
  const skillsStr = Array.isArray(profile?.skills)
    ? profile.skills.join(', ')
    : (typeof profile?.skills === 'object' && profile?.skills !== null
        ? Object.values(profile.skills).flat().join(', ')
        : profile?.skills || 'Not specified');

  // Build experience summary
  const experienceStr = profile?.experience
    ? JSON.stringify(profile.experience.slice(0, 3)).substring(0, 2000)
    : 'Multiple years of professional experience';

  // Build education summary
  const educationStr = profile?.education
    ? JSON.stringify(profile.education.slice(0, 2)).substring(0, 500)
    : 'Not specified';

  // Build seed answers context (candidate's personal insights)
  let seedContext = '';
  if (seedAnswers && typeof seedAnswers === 'object') {
    const seedParts = [];
    if (seedAnswers.career_motivation) seedParts.push(`Career Motivation: ${seedAnswers.career_motivation}`);
    if (seedAnswers.ideal_role) seedParts.push(`Ideal Role: ${seedAnswers.ideal_role}`);
    if (seedAnswers.career_goals) seedParts.push(`Career Goals: ${seedAnswers.career_goals}`);
    if (seedAnswers.proudest_achievement) seedParts.push(`Proudest Achievement: ${seedAnswers.proudest_achievement}`);
    if (seedAnswers.unique_strength) seedParts.push(`Unique Strength: ${seedAnswers.unique_strength}`);
    if (seedAnswers.work_style) seedParts.push(`Work Style & Values: ${seedAnswers.work_style}`);
    if (seedParts.length > 0) {
      seedContext = `\n\nCANDIDATE'S PERSONAL INSIGHTS (use these to write authentic, personalized answers):\n${seedParts.join('\n')}`;
    }
  }

  // Build enriched question list with field type and options context
  const meta = Array.isArray(questionMeta) ? questionMeta : [];
  const questionDescriptions = questions.map((q, i) => {
    const m = meta[i] || {};
    let desc = `${i + 1}. "${q}"`;
    if (m.fieldType && m.fieldType !== 'text') {
      desc += ` [Field type: ${m.fieldType}]`;
    }
    if (m.options && Array.isArray(m.options) && m.options.length > 0) {
      desc += `\n   Available options: ${m.options.join(' | ')}`;
    }
    return desc;
  }).join('\n');

  const prompt = `You are an expert career coach helping a job candidate answer application screening questions on a job application form.
Your answers will be directly inserted into form fields, so they must be accurate, specific, and appropriately formatted for each field type.

CANDIDATE PROFILE:
- Name: ${userFirstName || ''} ${userLastName || ''}
- Title: ${profile?.title || 'Professional'}
- Summary: ${profile?.summary || 'Experienced professional'}
- Skills: ${skillsStr}
- Location: ${profile?.location || 'United States'}
- Experience: ${experienceStr}
- Education: ${educationStr}${seedContext}

JOB CONTEXT:
${jobDescription ? jobDescription.substring(0, 2000) : 'Job application'}

SCREENING QUESTIONS TO ANSWER:
${questionDescriptions}

CRITICAL INSTRUCTIONS:
1. READ EACH QUESTION CAREFULLY. Answer ONLY what that specific question asks. Do not reuse or blend answers across questions.
2. For RADIO and SELECT fields: Your answer MUST exactly match one of the provided options. Choose the most appropriate option from the available list.
3. For TEXT fields with specific factual questions (years of experience, tech stack, etc.): Give a direct, concise answer derived from the profile.
4. For TEXTAREA / open-ended questions (e.g., "Why are you interested?", "Tell us about yourself", "Describe a challenge"):
   - Write 3-5 sentences that are specific to THIS candidate's actual background and THIS job
   - Reference specific skills, projects, or experiences from the profile
   - USE THE CANDIDATE'S PERSONAL INSIGHTS to make answers sound authentic and personal
   - Connect the candidate's motivations and career goals to the job requirements
   - Be genuine and professional, not generic or templated
   - Do NOT use placeholder language like "I am excited about this opportunity" without specific context
5. For yes/no questions: Answer "Yes" or "No" appropriately for a candidate seeking employment
6. Be truthful — do not fabricate experience or skills not present in the profile
7. Match your answer length to the field type: short for radio/select/text, detailed for textarea

WRITING STYLE (MANDATORY):
- Write like a real human, NOT like AI. Use natural, conversational prose.
- NEVER use dashes (—, –, -) as bullet separators or list markers.
- NEVER use bullet points, numbered lists, asterisks (*), or any list formatting.
- NEVER use phrases like "I am passionate about", "I am eager to", "I am thrilled", "I look forward to".
- Write in flowing sentences and short paragraphs. No headers, no bold, no markdown.
- Keep it casual-professional — the way a real person writes in a form field.
- Draw on the candidate's personal insights to make answers sound genuine and self-aware.

Return a JSON object where keys are the EXACT question text (matching the quotes above) and values are the answers:
{
  "Exact question text 1": "Answer 1",
  "Exact question text 2": "Answer 2"
}

Return ONLY valid JSON, no additional text or markdown.`;

  const completion = await aiService.generateText(prompt);

  let answers = {};
  try {
    let jsonText = completion.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    answers = JSON.parse(jsonText);

    // Post-process: strip AI formatting artifacts from all answers
    for (const key of Object.keys(answers)) {
      if (typeof answers[key] === 'string') {
        answers[key] = answers[key]
          .replace(/^[-•*]\s+/gm, '')           // remove leading bullets/dashes
          .replace(/^\d+\.\s+/gm, '')            // remove numbered list prefixes
          .replace(/\*\*([^*]+)\*\*/g, '$1')     // remove bold markdown
          .replace(/\*([^*]+)\*/g, '$1')          // remove italic markdown
          .replace(/^#+\s+/gm, '')               // remove markdown headers
          .replace(/\n{3,}/g, '\n\n')            // collapse excess newlines
          .trim();
      }
    }
  } catch (e) {
    console.error('Failed to parse AI response:', e);
    throw new AnswerGenerationParseError('Failed to parse AI response');
  }

  await recordAIUsage(userId, 'generate_answers');

  return { answers };
}

module.exports = { generateAnswers, AnswerGenerationValidationError, AnswerGenerationParseError };
