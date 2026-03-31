const express = require('express');
const { wrapRouter } = require('../middleware/asyncHandler');
const router = wrapRouter(express.Router());
const { db } = require('../dbConfig');
const logger = require('../utils/logger');
const { trackingLimiter } = require('../middleware/rateLimiter');
const { ensureApiAuthenticated } = require('../middleware/auth');

// Advertising Constants
const AD_IMPRESSION_VALUE = 0.001; // $0.001 per impression
const AD_CLICK_VALUE = 0.05;      // $0.05 per click

// GET Active Ads for Display
router.get('/active', async (req, res) => {
    try {
        const { data: ads, error } = await db
            .from("system_ads")
            .select("*")
            .eq("is_active", true)
            .order("display_priority", { ascending: false })
            .order("created_at", { ascending: false });

        if (error) throw error;
        res.json({ success: true, ads: ads });
    } catch (err) {
        logger.error("Error fetching active ads:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST Record Ad Impression with Fraud Prevention
router.post('/impression', trackingLimiter, async (req, res) => {
    const { adId, userId } = req.body;
    const ip = req.ip || req.get('x-forwarded-for') || req.connection.remoteAddress;

    try {
        // Fraud Prevention: Debounce impressions (1 minute window)
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
        const { data: recentImpression } = await db
            .from('ad_revenue_logs')
            .select('id')
            .eq('ad_id', adId)
            .eq('revenue_type', 'impression')
            .eq('ip_address', ip) // Assuming we add ip_address to ad_revenue_logs
            .gt('created_at', oneMinuteAgo);

        if (recentImpression && recentImpression.length > 0) {
            return res.json({ success: true, message: 'Impression debounced' });
        }

        // Record impression in logs
        const { error: logError } = await db
            .from('ad_revenue_logs')
            .insert([
                {
                    ad_id: adId,
                    user_id: userId || null,
                    revenue_type: 'impression',
                    amount: AD_IMPRESSION_VALUE,
                    ip_address: ip,
                    user_agent: req.get('User-Agent'),
                    created_at: new Date()
                }
            ]);

        if (logError) throw logError;

        // Increment ad impression count
        const { data: ad, error: adFetchError } = await db.from('system_ads').select('impressions').eq('id', adId).single();
        if (!adFetchError) {
            await db.from('system_ads').update({
                impressions: (ad.impressions || 0) + 1
            }).eq('id', adId);
        }

        // If userId is provided, credit their balance
        if (userId) {
            // Fetch and update user balance (Fallback if RPC not available)
            const { data: user, error: userFetchError } = await db.from('users').select('commission_balance').eq('id', userId).single();
            if (!userFetchError) {
                const newBalance = (parseFloat(user.commission_balance) || 0) + AD_IMPRESSION_VALUE;
                await db.from('users').update({ commission_balance: newBalance }).eq('id', userId);
            }
        }

        res.json({ success: true });
    } catch (err) {
        logger.error("Error tracking impression:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST Record Ad Click with Fraud Prevention
router.post('/click', trackingLimiter, async (req, res) => {
    const { adId, userId } = req.body;
    const ip = req.ip || req.get('x-forwarded-for') || req.connection.remoteAddress;

    try {
        // Fraud Prevention: Debounce clicks (5 minute window)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: recentClick } = await db
            .from('ad_revenue_logs')
            .select('id')
            .eq('ad_id', adId)
            .eq('revenue_type', 'click')
            .eq('ip_address', ip)
            .gt('created_at', fiveMinutesAgo);

        if (recentClick && recentClick.length > 0) {
            return res.json({ success: true, message: 'Click debounced' });
        }

        // Record click in logs
        const { error: logError } = await db
            .from('ad_revenue_logs')
            .insert([
                {
                    ad_id: adId,
                    user_id: userId || null,
                    revenue_type: 'click',
                    amount: AD_CLICK_VALUE,
                    ip_address: ip,
                    user_agent: req.get('User-Agent'),
                    created_at: new Date()
                }
            ]);

        if (logError) throw logError;

        // Increment ad click count and revenue generated
        const { data: ad, error: adFetchError } = await db.from('system_ads').select('clicks, revenue_generated').eq('id', adId).single();
        if (!adFetchError) {
            await db.from('system_ads').update({
                clicks: (ad.clicks || 0) + 1,
                revenue_generated: (parseFloat(ad.revenue_generated) || 0) + AD_CLICK_VALUE
            }).eq('id', adId);
        }

        // If userId is provided, credit their balance
        if (userId) {
            const { data: user, error: userFetchError } = await db.from('users').select('commission_balance').eq('id', userId).single();
            if (!userFetchError) {
                const newBalance = (parseFloat(user.commission_balance) || 0) + AD_CLICK_VALUE;
                await db.from('users').update({ commission_balance: newBalance }).eq('id', userId);
            }
        }

        res.json({ success: true });
    } catch (err) {
        logger.error("Error tracking click:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST Create Ad (User Submission)
router.post('/create', ensureApiAuthenticated, async (req, res) => {
    const { title, content, image_url, target_url } = req.body;
    const userId = req.user.id;

    if (!title || !target_url) {
        return res.status(400).json({ success: false, message: 'Title and Target URL are required' });
    }

    try {
        // Multi-tier check for advertising permission
        const { data: user, error: userErr } = await db.from('users').select('advertising_status').eq('id', userId).single();
        if (userErr || !user || user.advertising_status !== 'active') {
             return res.status(403).json({ success: false, message: 'Your advertising account is not active. Please apply first.' });
        }

        const { data, error } = await db
            .from('system_ads')
            .insert([
                {
                    title,
                    content,
                    image_url,
                    target_url,
                    user_id: userId,
                    is_active: true, // Activated in real-time as requested
                    display_priority: 0,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            ])
            .select();

        if (error) throw error;
        res.json({ success: true, message: 'Ad created and live!', ad: data[0] });
    } catch (err) {
        logger.error("Error creating ad:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET My Ads
router.get('/my-ads', ensureApiAuthenticated, async (req, res) => {
    try {
        const { data: ads, error } = await db
            .from('system_ads')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, ads });
    } catch (err) {
        logger.error("Error fetching my ads:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
