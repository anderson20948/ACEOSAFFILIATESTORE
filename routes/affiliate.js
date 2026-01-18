const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// Middleware to verify token 
const verifyToken = (req, res, next) => {
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

// Get Affiliate Stats
router.get('/stats', async (req, res) => {
    const userId = req.user.id;

    try {
        // Total Clicks
        const clicksResult = await db.query(`
            SELECT COUNT(*) FROM traffic_logs 
            JOIN tracking_links ON traffic_logs.link_id = tracking_links.id 
            WHERE tracking_links.user_id = $1`, [userId]);

        // Total Earnings
        const earningsResult = await db.query(`
            SELECT SUM(amount) FROM commissions 
            WHERE user_id = $1 AND status = 'paid'`, [userId]);

        // Pending Earnings
        const pendingResult = await db.query(`
            SELECT SUM(amount) FROM commissions 
            WHERE user_id = $1 AND status = 'pending'`, [userId]);

        res.json({
            clicks: clicksResult.rows[0].count,
            paidEarnings: earningsResult.rows[0].sum || 0,
            pendingEarnings: pendingResult.rows[0].sum || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching stats' });
    }
});

// Generate Tracking Link
router.post('/generate-link', async (req, res) => {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID required' });
    }

    try {
        // Check if product exists and is approved
        const productCheck = await db.query('SELECT * FROM products WHERE id = $1 AND status = $2', [productId, 'approved']);
        if (productCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found or not approved' });
        }

        // Generate Slug
        const slug = uuidv4().slice(0, 8); // Short random string
        // Construct original URL (Assuming internal product page for now, or could be external if products had external URLs)
        // For this MVP, let's assume the product has a generic "view" page or we redirect to a dummy merchant page.
        // The user said "original destination URLs".
        // Let's assume for now we redirect to a product display page on THIS site, or a placeholder external site.
        const originalUrl = `${process.env.BASE_URL}/products/view/${productId}`;

        const link = await db.query(
            'INSERT INTO tracking_links (user_id, product_id, slug, original_url) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, productId, slug, originalUrl]
        );

        res.json({ message: 'Link generated', link: link.rows[0], fullUrl: `${process.env.BASE_URL}/t/${slug}` });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error generating link' });
    }
});

// Get Commission History
router.get('/commissions', async (req, res) => {
    const userId = req.user.id;
    const { status, limit = 20, offset = 0 } = req.query;

    try {
        let query = 'SELECT * FROM commissions WHERE user_id = $1';
        let params = [userId];

        if (status) {
            query += ' AND status = $2';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(limit, offset);

        const commissions = await db.query(query, params);
        res.json(commissions.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching commissions' });
    }
});

// Request Commission Payout (Admin approval needed)
router.post('/request-payout', async (req, res) => {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount required' });
    }

    try {
        // Check available balance
        const balanceResult = await db.query(
            'SELECT SUM(amount) as total FROM commissions WHERE user_id = $1 AND status = $2',
            [userId, 'pending']
        );

        const availableBalance = parseFloat(balanceResult.rows[0].total || 0);

        if (amount > availableBalance) {
            return res.status(400).json({ error: 'Insufficient balance for payout request' });
        }

        // Create payout request (could be stored in a separate table or marked for admin review)
        await db.query(
            'INSERT INTO activities (message, created_at) VALUES ($1, NOW())',
            [`Payout request: $${amount} by user ${userId}`]
        );

        res.json({ message: 'Payout request submitted for review' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error processing payout request' });
    }
});

// Get Revenue Analytics
router.get('/analytics', async (req, res) => {
    const userId = req.user.id;

    try {
        // Monthly earnings
        const monthlyEarnings = await db.query(`
            SELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as earnings
            FROM commissions
            WHERE user_id = $1 AND status = 'paid'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month DESC
            LIMIT 12`, [userId]);

        // Top performing products
        const topProducts = await db.query(`
            SELECT p.title, COUNT(tl.id) as clicks, SUM(c.amount) as earnings
            FROM products p
            JOIN tracking_links tl ON p.id = tl.product_id
            LEFT JOIN commissions c ON c.user_id = $1
            WHERE tl.user_id = $1
            GROUP BY p.id, p.title
            ORDER BY earnings DESC
            LIMIT 5`, [userId]);

        res.json({
            monthlyEarnings: monthlyEarnings.rows,
            topProducts: topProducts.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching analytics' });
    }
});

module.exports = router;
