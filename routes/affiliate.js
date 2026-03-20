const express = require('express');
const router = express.Router();
const { db } = require('../dbConfig');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Middleware to verify token (Supports both Token and Session)
const verifyToken = (req, res, next) => {
    // 1. Check Passport Session first
    if (req.isAuthenticated()) {
        return next();
    }

    // 2. Fallback to Token verification
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(403).json({ error: 'Invalid token' });
    }
};

router.use(verifyToken);

// --- Dashboard & Stats Routes ---

// Get Affiliate Stats
router.get('/stats', async (req, res) => {
    const userId = req.user.id;
    try {
        // Total Clicks from traffic_logs
        const { count: totalClicks } = await db
            .from('traffic_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Earnings (commission balance from user record)
        const { data: userRecord } = await db
            .from('users')
            .select('commission_balance')
            .eq('id', userId)
            .single();

        // Active Campaigns
        const { count: activeCampaigns } = await db
            .from('advertising_campaigns')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'active');

        // Pending Applications
        const { count: pendingApps } = await db
            .from('advertising_applications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'pending');

        res.json({
            success: true,
            stats: {
                totalClicks: totalClicks || 0,
                earnings: userRecord?.commission_balance || 0,
                activeCampaigns: activeCampaigns || 0,
                pendingApplications: pendingApps || 0
            }
        });
    } catch (err) {
        logger.error("Affiliate Stats Error:", err);
        res.status(500).json({ success: false, error: 'Error fetching stats' });
    }
});

// Get user's advertising applications
router.get("/applications", async (req, res) => {
    const userId = req.user.id;
    try {
        const { data: applications, error } = await db
            .from('advertising_applications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, applications });
    } catch (err) {
        logger.error("Error fetching applications:", err);
        res.status(500).json({ success: false, message: "Failed to fetch applications" });
    }
});

// POST Submit Advertising Application (Restored)
router.post("/advertising/apply", async (req, res) => {
    const { application_type, social_media_accounts, website_urls, paypal_email, additional_notes } = req.body;
    const userId = req.user.id; // middleware ensures req.user

    if (!application_type || !paypal_email) {
        return res.status(400).json({ success: false, message: "Application type and PayPal email are required" });
    }

    try {
        // Insert advertising application
        const { data: applicationResult, error: insertError } = await db
            .from('advertising_applications')
            .insert([
                {
                    user_id: userId,
                    application_type,
                    social_media_accounts: social_media_accounts,
                    website_urls: website_urls,
                    paypal_email,
                    status: 'pending',
                    admin_notes: additional_notes,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            ])
            .select('id');

        if (insertError) throw insertError;

        // Update user advertising status
        const { error: updateError } = await db
            .from('users')
            .update({ advertising_status: 'pending' })
            .eq('id', userId);

        if (updateError) throw updateError;

        // Create admin notification
        const { error: notifyError } = await db
            .from('admin_notifications')
            .insert([
                {
                    notification_type: 'application',
                    reference_id: applicationResult[0].id,
                    title: 'New Advertising Application',
                    message: `User ${req.user.name || 'User'} submitted a ${application_type} application`,
                    priority: 'normal',
                    created_at: new Date()
                }
            ]);

        if (notifyError) throw notifyError;

        // Log user activity
        await db.from('user_activity_logs').insert([{
            user_id: userId,
            activity_type: 'advertising_application',
            details: { application_type, paypal_email },
            ip_address: req.ip || 'unknown',
            user_agent: req.get('User-Agent'),
            created_at: new Date()
        }]);

        res.json({
            success: true,
            message: "Application submitted successfully. You will receive an email confirmation shortly.",
            applicationId: applicationResult[0].id
        });

    } catch (err) {
        logger.error("Advertising application error:", err);
        res.status(500).json({ success: false, message: "Failed to submit application" });
    }
});

// Get user's campaigns
router.get("/campaigns", async (req, res) => {
    const userId = req.user.id;
    try {
        const { data: campaigns, error } = await db
            .from('advertising_campaigns')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, campaigns });
    } catch (err) {
        logger.error("Error fetching campaigns:", err);
        res.status(500).json({ success: false, message: "Failed to fetch campaigns" });
    }
});

// --- Link Generation & Commissions ---

// Generate Tracking Link
router.post('/generate-link', async (req, res) => {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID required' });
    }

    try {
        // Check if product exists and is approved
        const { data: product, error: fetchError } = await db
            .from('products')
            .select('*')
            .eq('id', productId)
            .eq('status', 'approved')
            .single();

        if (fetchError || !product) {
            return res.status(404).json({ error: 'Product not found or not approved' });
        }

        const slug = uuidv4().slice(0, 8);
        const originalUrl = `${process.env.BASE_URL || ''}/products/view/${productId}`;

        const { data: link, error: insertError } = await db
            .from('tracking_links')
            .insert([{ user_id: userId, product_id: productId, slug, original_url: originalUrl }])
            .select('*')
            .single();

        if (insertError) throw insertError;

        res.json({
            message: 'Link generated',
            link,
            fullUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/t/${slug}`
        });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ error: 'Error generating link' });
    }
});

// Get Commission History
router.get('/commissions', async (req, res) => {
    const userId = req.user.id;
    const { status, limit = 20 } = req.query;

    try {
        let query = db.from('commissions').select('*').eq('user_id', userId);

        if (status) {
            query = query.eq('status', status);
        }

        const { data: commissions, error } = await query
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (error) throw error;
        res.json(commissions);
    } catch (err) {
        logger.error(err);
        res.status(500).json({ error: 'Error fetching commissions' });
    }
});

// --- Activity Tracking Routes (Moved from server.js) ---

router.post("/activity/start-session", async (req, res) => {
    const { userId, ipAddress, userAgent } = req.body;
    try {
        const sessionToken = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const { data: result, error: insertError } = await db
            .from('user_sessions')
            .insert([
                { user_id: userId, session_token: sessionToken, login_time: new Date(), last_activity: new Date(), ip_address: ipAddress, user_agent: userAgent, created_at: new Date() }
            ])
            .select('id');

        if (insertError) throw insertError;
        await db.from('users').update({ last_login: new Date() }).eq('id', userId);
        res.json({ success: true, sessionId: result[0].id });
    } catch (err) {
        logger.error("Error starting session:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post("/activity/update-session", async (req, res) => {
    const { sessionId } = req.body;
    try {
        await db.from('user_sessions')
            .update({ last_activity: new Date() })
            .eq('id', sessionId)
            .eq('is_active', true);
        res.json({ success: true });
    } catch (err) {
        logger.error("Error updating session:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post("/activity/end-session", async (req, res) => {
    const { sessionId } = req.body;
    try {
        await db.from('user_sessions')
            .update({ logout_time: new Date(), is_active: false })
            .eq('id', sessionId);
        res.json({ success: true });
    } catch (err) {
        logger.error("Error ending session:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post("/activity/bulk", async (req, res) => {
    const { activities } = req.body;
    if (!Array.isArray(activities) || activities.length === 0) {
        return res.status(400).json({ success: false, message: "Invalid activities data" });
    }

    try {
        const { error } = await db
            .from('user_activity_logs')
            .insert(activities.map(act => ({
                user_id: act.userId || null,
                session_id: act.sessionId,
                activity_type: act.activityType,
                details: act.details,
                ip_address: req.ip || act.ipAddress || 'unknown',
                user_agent: act.userAgent || req.get('User-Agent'),
                created_at: act.timestamp || new Date()
            })));

        if (error) throw error;
        res.json({ success: true, count: activities.length });
    } catch (err) {
        logger.error("Error bulk inserting activities:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
