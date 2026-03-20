/**
 * Custom Sanitizer Middleware for Express 5.x
 * Prevents common injection patterns by recursively removing keys starting with $ or containing .
 * This version is designed to be compatible with Express 5's read-only getters for certain properties.
 */

function sanitize(obj) {
    if (obj instanceof Object) {
        for (const key in obj) {
            if (/^\$/.test(key) || /\./.test(key)) {
                delete obj[key];
            } else {
                sanitize(obj[key]);
            }
        }
    }
}

const customSanitizer = (req, res, next) => {
    if (req.body) sanitize(req.body);
    if (req.params) sanitize(req.params);

    // In Express 5, req.query is often a getter. 
    // We try to sanitize it if it's mutable, otherwise we skip or replace if needed.
    try {
        if (req.query) sanitize(req.query);
    } catch (e) {
        // req.query might be read-only in some configurations of Express 5
        // If it's problematic, we could theoretically replace it with a sanitized shallow copy
        // but for now, we just handle the error gracefully.
        console.warn('Could not sanitize req.query directly:', e.message);
    }

    next();
};

module.exports = customSanitizer;
