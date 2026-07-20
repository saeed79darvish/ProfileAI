const parseBool = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const parseEmailList = (value) =>
  String(value || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

module.exports = {
  // Master gate for the recruiter side of the product. Candidate-only
  // launch keeps this OFF — every recruiter-only API route returns 404
  // and the AI cost-bomb surfaces (smartMatch, recruiter job AI, VAPI
  // phone screening, candidate search) are effectively decommissioned
  // until we flip this on. See middleware/recruiterSurface.js.
  recruiterSurface: parseBool(process.env.ENABLE_RECRUITER_SURFACE, false),
  recruiterAgentArena: parseBool(process.env.ENABLE_RECRUITER_AGENT_ARENA, false),
  // ApplyPilot master gate. When OFF, the ApplyPilot navbar link is
  // hidden, /api/applypilot/* returns 404, and ApplyPilotGateway
  // redirects authenticated users away from the section. Admins and
  // anyone in APPLYPILOT_ALLOWED_USERS bypass the gate for staged
  // tester rollout. Default OFF for the soft launch — flip to true
  // once the auto-submit pipeline is verified end-to-end.
  applyPilotEnabled: parseBool(process.env.ENABLE_APPLYPILOT, false),
  // Comma-separated email allowlist. Lower-cased and trimmed. Useful
  // for letting specific testers see ApplyPilot before flipping the
  // global flag for everyone. Example:
  //   APPLYPILOT_ALLOWED_USERS=tester1@x.com, tester2@y.com
  applyPilotAllowedUsers: parseEmailList(process.env.APPLYPILOT_ALLOWED_USERS),
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
  // Mobile bookmarklet (pairing + AI autofill for phone browsers where the
  // Chrome extension can't run). Mounts /api/bookmarklet/* with its own
  // CORS policy (reflects any origin, since job sites are arbitrary) and
  // serves the public /bookmarklet.js runtime. Default ON; flip off in the
  // Render dashboard as an instant kill switch if the new public surface
  // needs to come down without a redeploy.
  bookmarklet: parseBool(process.env.ENABLE_BOOKMARKLET, true),
};

/**
 * userCanAccessApplyPilot(user)
 *
 * Returns true if the given user object (from req.user or User.findByPk)
 * is allowed to use the ApplyPilot feature. Resolution order:
 *   1. Admins ALWAYS have access (dogfooding / QA / support).
 *   2. Global flag (ENABLE_APPLYPILOT) is on — all eligible roles in.
 *   3. Per-user email allowlist — specific testers in even when flag is off.
 *
 * Always returns false for users whose role isn't `candidate` or `admin`
 * since ApplyPilot is a candidate surface (recruiters never see it
 * regardless of flag state).
 */
module.exports.userCanAccessApplyPilot = function userCanAccessApplyPilot(user) {
  if (!user) return false;
  const role = user.role || user.dataValues?.role;
  if (role !== 'candidate' && role !== 'admin') return false;
  // Admins always have access.
  if (role === 'admin') return true;
  // Global flag on — everyone with a candidate role gets in.
  if (module.exports.applyPilotEnabled) return true;
  // Per-user allowlist (email match).
  const email = String(user.email || user.dataValues?.email || '').toLowerCase();
  if (!email) return false;
  return module.exports.applyPilotAllowedUsers.includes(email);
};
