const jwt = require('jsonwebtoken');

const getTokenFromRequest = (req) => {
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1];
  return token || null;
};

const clearAuthCookie = (res) => {
  res.clearCookie('token');
};

const sendExpiredSession = (res) => {
  clearAuthCookie(res);
  return res.status(401).json({
    success: false,
    code: 'SESSION_EXPIRED',
    message: 'Session expired. Please log in again.'
  });
};

const decodeToken = (token) => {
  if (!token) {
    throw new Error('NO_TOKEN');
  }
  return jwt.verify(token, process.env.JWT_SECRET || 'aceos-secret-key');
};

const getUserFromRequest = (req) => {
  const token = getTokenFromRequest(req);
  if (!token) {
    throw new Error('NO_TOKEN');
  }
  return decodeToken(token);
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
    const decoded = decodeToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    return sendExpiredSession(res);
  }
};

module.exports = {
  ensureApiAuthenticated,
  getTokenFromRequest,
  clearAuthCookie,
  decodeToken,
  getUserFromRequest
};
