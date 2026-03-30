const logger = require('../utils/logger');

// Define the allow-list for redirects
const ALLOWED_DOMAINS = [
    'localhost:3000',
    'https://github.com/anderson20948/ACEOSAFFILIATESTORE', // Placeholder for production
    'aceo.com' // Example brand domain
];

/**
 * Validate that a URL is safe to redirect to.
 * Prevents Open Redirect vulnerabilities.
 */
function isValidRedirect(url) {
    if (!url) return false;

    // Relative paths are always safe
    if (url.startsWith('/') && !url.startsWith('//')) {
        return true;
    }

    try {
        const parsedUrl = new URL(url);
        return ALLOWED_DOMAINS.includes(parsedUrl.host);
    } catch (e) {
        return false;
    }
}

/**
 * Middleware to enhance res.redirect with validation.
 */
function redirectValidator(req, res, next) {
    const originalRedirect = res.redirect;

    res.safeRedirect = function (target, status = 302) {
        if (isValidRedirect(target)) {
            return originalRedirect.call(this, status, target);
        } else {
            logger.warn('Blocked unsafe redirect attempt', { target, ip: req.ip, path: req.path });
            return originalRedirect.call(this, status, '/'); // Fallback to safe home
        }
    };

    next();
}

module.exports = { redirectValidator, isValidRedirect };
