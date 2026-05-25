const parseBool = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

module.exports = {
  // Master gate for the recruiter side of the product. Candidate-only
  // launch keeps this OFF — every recruiter-only API route returns 404
  // and the AI cost-bomb surfaces (smartMatch, recruiter job AI, VAPI
  // phone screening, candidate search) are effectively decommissioned
  // until we flip this on. See middleware/recruiterSurface.js.
  recruiterSurface: parseBool(process.env.ENABLE_RECRUITER_SURFACE, false),
  recruiterAgentArena: parseBool(process.env.ENABLE_RECRUITER_AGENT_ARENA, false),
  // Hybrid pivot: ApplyPilot prepares materials only; the candidate
  // submits manually. Auto-submit machinery (workers, scout enqueue,
  // approve/submit routes) is dormant unless this flag is explicitly on.
  applyPilotAutoSubmit: parseBool(process.env.APPLYPILOT_AUTOSUBMIT, false),
  // Social feed (/api/posts, comments, likes, saves). Off for launch;
  // toggle on per environment to expose the /feed page + backing API.
  feed: parseBool(process.env.ENABLE_FEED, false),
  // Claude Connector — exposes the /mcp endpoint (Remote MCP server) so
  // ProfilleAI can be added as a Custom Connector in Claude.ai. Off by
  // default; enable per environment once the connector is ready to use.
  claudeConnector: parseBool(process.env.ENABLE_CLAUDE_CONNECTOR, false),
};
