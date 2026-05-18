/**
 * MCP Bearer-token auth.
 *
 * Custom Connectors in Claude.ai support a full OAuth 2.1 flow with
 * dynamic client registration. For v1 we accept a plain ProfileAI JWT
 * in the `Authorization: Bearer <token>` header — the same token the
 * REST API already uses (see backend/middleware/auth.js).
 *
 * This keeps the connector usable today (paste your JWT) and leaves
 * room to bolt on the OAuth 2.1 endpoints later without changing the
 * tool implementations.
 */

const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Parse the Authorization header from an incoming Express request and
 * resolve it to a ProfileAI user. Returns `null` if no/invalid token —
 * tools then decide whether to require auth or operate anonymously.
 */
async function resolveAuthUser(req) {
  try {
    const header = req.header('Authorization') || req.header('authorization') || '';
    const token = header.replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] },
    });
    if (!user || !user.isActive) return null;
    return user;
  } catch (err) {
    return null;
  }
}

/**
 * Throw a tool-friendly error when an authed user is required but
 * missing. The MCP server catches thrown errors and surfaces them to
 * Claude as a normal tool failure message.
 */
function requireAuth(user) {
  if (!user) {
    const err = new Error(
      'Sign-in required. Connect ProfileAI in Claude settings and authorize the connector.',
    );
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  return user;
}

/** Throw if the authed user does not have one of the allowed roles. */
function requireRole(user, allowedRoles) {
  requireAuth(user);
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!roles.includes(user.role)) {
    const err = new Error(
      `This tool is only available to ${roles.join(' / ')} accounts on ProfileAI.`,
    );
    err.code = 'FORBIDDEN';
    throw err;
  }
  return user;
}

module.exports = { resolveAuthUser, requireAuth, requireRole };
