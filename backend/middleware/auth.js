const jwt = require('jsonwebtoken');

const getTokenFromRequest = (req) => {
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1];
  return token || null;
};

const ensureApiAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'aceos-secret-key');
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired' });
  }
};

module.exports = {
  ensureApiAuthenticated,
  getTokenFromRequest
};
