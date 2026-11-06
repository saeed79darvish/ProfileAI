import { careerContextAPI } from '../services/api';

/**
 * Save what a guest told the coach once the account exists. The coaching
 * facts go to the merge endpoint as before. Answer memory (answerFacts,
 * answerStories) is split off and saved with PATCH /career-context, which is
 * the only endpoint that takes it. Fire-and-forget: failing here must never
 * cost anyone the profile they just built.
 */
export function landCareerContext(careerContext) {
  if (!careerContext || !Object.keys(careerContext).length) return;
  const { answerFacts, answerStories, ...rest } = careerContext;
  if (Object.keys(rest).length) careerContextAPI.merge(rest).catch(() => {});
  const answers = {};
  if (answerFacts && Object.keys(answerFacts).length) answers.answerFacts = answerFacts;
  if (answerStories && Object.keys(answerStories).length) answers.answerStories = answerStories;
  if (Object.keys(answers).length) careerContextAPI.edit(answers).catch(() => {});
}
