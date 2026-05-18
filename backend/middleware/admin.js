/**
 * Admin Authorization Middleware
 * Requires authMiddleware to run first (sets req.user)
 */
const { User } = require('../models');

const adminMiddleware = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findByPk(req.user.id, { attributes: ['id', 'role'] });

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

module.exports = adminMiddleware;
