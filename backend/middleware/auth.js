const jwt = require('jsonwebtoken');
const { db } = require('../dbConfig');
const logger = require('../utils/logger');


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

const verifyAdmin = async (req, res, next) => {
    const logUnauthorized = async (reason, details) => {
        try {
            await db.from('admin_notifications').insert([{
                notification_type: 'security_alert',
                title: 'Unauthorized Access Attempt',
                message: `Alert: Unauthorized attempt to access ${req.path} from IP ${req.ip}. Reason: ${reason}. ${details || ''}`,
                priority: 'critical'
            }]);
            logger.warn('Security Alert: Unauthorized access attempt', { path: req.path, ip: req.ip, reason });
        } catch (err) {
            logger.error('Failed to log security notification', err);
        }
    };

    // 1. Check Passport Session first
    if (req.isAuthenticated && req.isAuthenticated() && req.user?.role === 'admin') {
        return next();
    }

    const token = getTokenFromRequest(req);
    if (!token) {
        await logUnauthorized('No token provided');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = decodeToken(token);
        if (decoded.role !== 'admin') {
            await logUnauthorized('Insufficient permissions', `User ID: ${decoded.id}, Role: ${decoded.role}`);
            return res.status(403).json({ error: 'Access denied. Admins only.' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        await logUnauthorized('Invalid or expired token', err.message);
        clearAuthCookie(res);
        return res.status(401).json({ error: 'Session expired or invalid token.' });
    }
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
  verifyAdmin,
  getTokenFromRequest,
  clearAuthCookie,
  decodeToken,
  getUserFromRequest
};
