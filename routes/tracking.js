const express = require('express');
const router = express.Router();
const { db } = require('../dbConfig');
const logger = require('../utils/logger');
const { trackingLimiter } = require('../middleware/rateLimiter');

// Tracking Redirect Route with Fraud Prevention (Click Debouncing)
router.get('/:slug', trackingLimiter, async (req, res) => {
    const { slug } = req.params;
    const ip = req.ip || req.get('x-forwarded-for') || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    try {
        // Find the link
        const { data: link, error: linkError } = await db
            .from('tracking_links')
            .select('*')
            .eq('slug', slug)
            .single();

        if (linkError || !link) {
            return res.status(404).send('Link not found');
        }

        // Logic behind Fraud Prevention: Click Debouncing
        // Check if there's already a click from this IP for this link in the last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const { data: recentClicks, error: clickCheckError } = await db
            .from('traffic_logs')
            .select('id')
            .eq('link_id', link.id)
            .eq('ip_address', ip)
            .gt('created_at', fiveMinutesAgo);

        if (!clickCheckError && recentClicks && recentClicks.length > 0) {
            // Already logged recently, just redirect without double-counting
            console.log(`[FRAUD PREVENTION] Debounced duplicate click from ${ip} for slug ${slug}`);
            return res.redirect(link.original_url);
        }

        // Log the click
        const { data: logResult, error: logError } = await db
            .from('traffic_logs')
            .insert([
                {
                    link_id: link.id,
                    user_id: link.user_id, // Store which affiliate gets credit
                    product_id: link.product_id, // Store which product was clicked
                    ip_address: ip,
                    user_agent: userAgent,
                    created_at: new Date()
                }
            ])
            .select('id');

        if (logError) throw logError;

        const clickId = logResult[0].id;

        // Set Cookie (30 days) to track potential conversion later
        res.cookie('affiliate_click_id', clickId, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        // Redirect
        res.redirect(link.original_url);

    } catch (err) {
        logger.error('Error tracking affiliate link', { error: err.message, slug });
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;
