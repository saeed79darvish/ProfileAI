/**
 * Wires the interview prep pipeline to the real model and the configured
 * provider. Kept apart from interviewPrepService so tests never load this.
 */
const { resolveProviderName, getSearch } = require('./research/searchProvider');
const { researchInterview } = require('./interviewPrepService');

/** Small Haiku call: returns the raw text. No temperature (Claude 5 rejects it). */
async function runModel({ system, prompt, maxTokens }) {
  const { callAI, HAIKU_MODEL } = require('./ai/core');
  const res = await callAI({
    messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    max_tokens: maxTokens || 2000,
    model: HAIKU_MODEL,
  });
  return res.choices[0].message.content;
}

/** Returns the research function for the configured provider; throws search_not_configured. */
function getResearch(env = process.env) {
  const provider = resolveProviderName(env);
  if (provider === 'anthropic') {
    const { researchViaAnthropicWebSearch } = require('./research/anthropicWebResearch');
    return async (input) => {
      console.log(`[interviewPrep] researching via ${provider}`);
      return { ...(await researchViaAnthropicWebSearch(input)), provider };
    };
  }
  const search = getSearch(env);
  return async (input) => {
    console.log(`[interviewPrep] researching via ${provider}`);
    return { ...(await researchInterview({ ...input, search, runModel })), provider };
  };
}

module.exports = { runModel, getResearch };
