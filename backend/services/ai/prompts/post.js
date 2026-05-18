/**
 * Post-related AI prompts
 * Prompts for enhancing posts and generating suggestions
 */

/**
 * Enhance post prompt
 */
const enhancePostPrompt = (content, roleContext, maxLength) => `You are a professional writing assistant for ${roleContext}. Your job is to LIGHTLY POLISH an existing post.

ABSOLUTE RULES:
1. Keep the user's EXACT message and meaning - only fix typos and grammar
2. Output must be ${maxLength} characters or less
3. Do NOT add new ideas, questions, or calls to action
4. Do NOT generate repetitive or looping content - NEVER repeat words or phrases
5. If the post is already good, return it mostly unchanged
6. 1-2 emojis maximum

Original post (${content.length} chars):
"${content}"

Respond with ONLY valid JSON:
{
  "enhanced": "polished version here",
  "hashtags": ["tag1", "tag2", "tag3"],
  "improvements": ["brief note on what changed"],
  "engagementScore": 75
}`;

/**
 * Generate post suggestions prompt
 */
const postSuggestionsPrompt = (userRole, roleContext, currentContent = '') => `Generate 5 creative post ideas and 3 content templates for a ${userRole} to post on a professional networking platform. Focus on topics related to ${roleContext}.
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

module.exports = {
  enhancePostPrompt,
  postSuggestionsPrompt
};
