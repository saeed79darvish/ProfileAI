/**
 * Verifies the JWT that the frontend attaches as `Authorization: Bearer`.
 * The token is the same one issued by the main ProfileAI auth service;
 * we just need to decode it here and stash user.id on the request.
 */
import jwt from 'jsonwebtoken';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Match the main backend's payload shape — { id, role, email }.
    if (payload.role !== 'candidate') {
      return res.status(403).json({ error: 'candidate_only' });
    }
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}
