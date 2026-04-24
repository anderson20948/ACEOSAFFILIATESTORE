const { db } = require('../dbConfig');
const logger = require('../utils/logger');

/**
 * Fraud Detection Middleware
 * Monitors traffic patterns and flags suspicious activity
 */
const detectFraud = async (req, res, next) => {
    const ip = req.ip || req.get('x-forwarded-for') || req.connection.remoteAddress;
    const { slug } = req.params;

    try {
        // Threshold: Max 20 clicks per IP per minute per link
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
        
        const { data: clickCount, error } = await db
            .from('traffic_logs')
            .select('id', { count: 'exact', head: true })
            .eq('ip_address', ip)
            .gt('created_at', oneMinuteAgo);

        if (clickCount > 20) {
            logger.warn(`[FRAUD ALERT] High frequency clicks from IP: ${ip}`, { ip, count: clickCount });
            
            // Log to admin notifications
            await db.from('admin_notifications').insert([{
                notification_type: 'fraud_alert',
                title: 'Suspicious Traffic Pattern',
                message: `IP ${ip} generated ${clickCount} clicks in 1 minute. Access throttled.`,
                priority: 'high',
                created_at: new Date()
            }]);

            return res.status(429).json({ error: 'Too many requests. Suspicious activity detected.' });
        }

        next();
    } catch (err) {
        logger.error('Fraud detection error:', err);
        next(); // Proceed anyway to avoid blocking legitimate users on internal error
    }
};

module.exports = { detectFraud };
