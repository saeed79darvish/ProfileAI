const parseBool = (value: string | undefined, defaultValue = false): boolean => {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

export const featureFlags = {
  // Master gate for the entire recruiter side of the product
  // (recruiter dashboard, browse profiles, harvest, AI tools, etc.).
  // Candidate-only launch keeps this OFF — recruiter routes are not
  // rendered and the recruiter nav links are hidden.
  recruiterSurface: parseBool(import.meta.env.VITE_ENABLE_RECRUITER_SURFACE, false),
  recruiterAgentArena: parseBool(import.meta.env.VITE_ENABLE_RECRUITER_AGENT_ARENA, false),
  // Social feed (/feed) — currently disabled for launch. Toggle on per environment.
  feed: parseBool(import.meta.env.VITE_ENABLE_FEED, false),
  // Claude Connector promo/onboarding UI ("Use ProfilleAI in Claude" cards).
  // Backend exposure is gated separately by ENABLE_CLAUDE_CONNECTOR.
  claudeConnector: parseBool(import.meta.env.VITE_ENABLE_CLAUDE_CONNECTOR, false),
  // ApplyPilot "Coach training" tab — chat-based agent training surface.
  // Hidden by default while we focus the demo on Job criteria → scout →
  // review → approve. The CoachPage code still ships so we can flip
  // this on without a code change once the training UX is finished.
  applyPilotCoach: parseBool(import.meta.env.VITE_ENABLE_APPLYPILOT_COACH, false),
};
