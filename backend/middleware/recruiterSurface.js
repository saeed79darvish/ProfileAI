/**
 * Recruiter Surface Gate
 *
 * Candidate-only launch: every recruiter API surface is wrapped in this
 * middleware. When `featureFlags.recruiterSurface` is false we return 404
 * so the endpoints simply do not exist from a client's perspective.
 *
 * Wired at the router-mount level in server.js for fully recruiter-only
 * routers, and at the route level for mixed routers (jobs, invitations,
 * messages) that share endpoints between candidates and recruiters.
 */
const featureFlags = require('../config/featureFlags');

const requireRecruiterSurface = (req, res, next) => {
  if (!featureFlags.recruiterSurface) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
};

module.exports = requireRecruiterSurface;
