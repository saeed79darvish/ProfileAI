/**
 * requireVerifiedEmail
 *
 * Defense-in-depth backend gate for endpoints that should be unreachable
 * until a user has verified their email. Must run AFTER `authMiddleware`
 * so that `req.user` is populated.
 *
 * Behavior:
 *  - If `req.user` is missing, returns 401 (treat as unauthenticated).
 *  - If `req.user.emailVerified !== true`, returns 403 with a structured
 *    body the frontend can use to redirect the user to /check-email:
 *      {
 *        error: 'email_not_verified',
 *        message: '...',
 *        redirectTo: '/check-email'
 *      }
 *  - Otherwise calls next().
 *
 * The frontend `PrivateRoute` already performs the same gate on the client.
 * This middleware exists so the API cannot be reached by curl, the
 * Chrome extension, or any other client that bypasses the React shell.
 */
const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No token, authorization denied' });
  }
  if (req.user.emailVerified !== true) {
    return res.status(403).json({
      error: 'email_not_verified',
      message: 'Please verify your email address before using this feature.',
      redirectTo: '/check-email'
    });
  }
  return next();
};

module.exports = requireVerifiedEmail;
