/**
 * callSummaryPrompt — a voice call, kept as a few sentences.
 *
 * The summary is what the person will read back in "What ProfilleAI knows
 * about you", and what the coach reads before the next conversation. So it
 * is written about them, plainly, from only what they said.
 */
const { timeFacts } = require('./timeFacts');

const callSummaryPrompt = ({ lines }) => `Summarise this career-coaching call in 2 to 4 short sentences, for the candidate's own record.

${timeFacts({})}

THE CALL:
${lines.map((l) => `${l.role}: ${l.text}`).join('\n')}

RULES:
- Write in the second person ("You want...", "You said..."), because the candidate reads this.
- Only what THEY said: their goals, what is pulling them, what is in the way, constraints like location, pay or timing. Not the coach's advice.
- Invent nothing. If they did not say it, it is not in the summary.
- No health, family, religion or other personal details beyond what bears on their job search.
- No em dashes. Plain sentences, no bullet points, no preamble.

Return only the summary.`;

module.exports = { callSummaryPrompt };
