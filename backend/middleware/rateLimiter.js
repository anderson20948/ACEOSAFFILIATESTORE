const rateLimit = require('express-rate-limit');

// General API Rate Limiter
// Limits each IP to 100 requests per 15 minutes
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Increased for scalability (handles more concurrent users)
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests. System is under high load, please try again shortly.'
    }
});

// Generous Limiter for Dashboard Auto-Refresh
const dashboardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // Allows ~1 request every 2 seconds
    standardHeaders: true,
    legacyHeaders: false
});

// Stricter Limiter for Auth Routes
// Limits each IP to 10 requests per hour for login/register/forgot-password
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many authentication attempts. Please try again after an hour.'
    }
});

// Stricter Limiter for Ad Clicks/Impressions (Fraud Prevention)
// Limits to 20 tracking events per 15 minutes
const trackingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Excessive tracking activity detected.'
    }
});

// Email limiter (3 attempts / 10 mins)
const emailLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 3,
    message: { success: false, message: "Too many email attempts, please try again after 10 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    generalLimiter,
    authLimiter,
    trackingLimiter,
    emailLimiter,
    dashboardLimiter
};
