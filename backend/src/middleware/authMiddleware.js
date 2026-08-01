const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized, token missing' });
    }

    const token = authHeader.split(' ')[1];
    // Explicitly pin the accepted algorithm to what generateToken actually signs with,
    // rather than relying on jsonwebtoken's default allow-list - defense-in-depth against
    // algorithm-confusion attacks regardless of library defaults.
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

// Must run after `protect` - relies on req.user already being populated. Gates
// genuinely admin-only endpoints (platform-wide analytics, question-bank stats) that
// were previously reachable by any authenticated user since no authorization layer
// existed beyond "is logged in".
const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  return next();
};

module.exports = { protect, requireAdmin };
