const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for feature uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/features');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Middleware to verify admin (Simplified)
const verifyAdmin = (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admins only.' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        res.status(403).json({ error: 'Invalid token' });
    }
};

router.use(verifyAdmin);

// Get Pending Products
router.get('/pending-products', async (req, res) => {
    try {
        const products = await db.query('SELECT * FROM products WHERE status = $1', ['pending']);
        res.json(products.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching pending products' });
    }
});

// Approve Product
router.post('/approve-product', async (req, res) => {
    const { productId, action } = req.body; // action: 'approve' or 'reject'

    if (!productId || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    const status = action === 'approve' ? 'approved' : 'rejected';

    try {
        const result = await db.query(
            'UPDATE products SET status = $1 WHERE id = $2 RETURNING *',
            [status, productId]
        );
        res.json({ message: `Product ${status}`, product: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating product status' });
    }
});

// Get Admin Statistics
router.get('/stats', async (req, res) => {
    try {
        const userCount = await db.query('SELECT COUNT(*) FROM users');
        const paymentTotal = await db.query('SELECT SUM(amount) FROM payments');
        const clickCount = await db.query('SELECT COUNT(*) FROM traffic_logs');
        const pendingProducts = await db.query('SELECT COUNT(*) FROM products WHERE status = $1', ['pending']);

        res.json({
            totalUsers: userCount.rows[0].count,
            totalRevenue: paymentTotal.rows[0].sum || 0,
            totalClicks: clickCount.rows[0].count,
            pendingApprovals: pendingProducts.rows[0].count
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching stats' });
    }
});

// Get Payment History
router.get('/payments', async (req, res) => {
    try {
        const payments = await db.query(
            'SELECT p.*, u.username, pr.title as product_title FROM payments p JOIN users u ON p.user_id = u.id JOIN products pr ON p.product_id = pr.id ORDER BY p.created_at DESC'
        );
        res.json(payments.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching payments' });
    }
});

// Get User Listing
router.get('/users', async (req, res) => {
    try {
        const users = await db.query('SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC');
        res.json(users.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching users' });
    }
});

// Get System Activities
router.get('/activities', async (req, res) => {
    try {
        const activities = await db.query(
            'SELECT s.*, u.username FROM system_logs s LEFT JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 50'
        );
        res.json(activities.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching activities' });
    }
});

// Execute JSON configuration
router.post('/execute', async (req, res) => {
    const config = req.body;
    try {
        // Log the execution
        await db.query(
            'INSERT INTO system_logs (user_id, activity_type, details) VALUES ($1, $2, $3)',
            [req.user.id, 'json_execute', `Executed config: ${JSON.stringify(config).substring(0, 100)}...`]
        );

        // Example: Handle specific actions from JSON
        if (config.action === 'update_revenue_share') {
            // Logic here...
        }

        res.json({ message: 'JSON configuration executed successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error executing JSON input.' });
    }
});

// Upload Feature
router.post('/upload-feature', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    try {
        await db.query(
            'INSERT INTO system_logs (user_id, activity_type, details) VALUES ($1, $2, $3)',
            [req.user.id, 'feature_upload', `Uploaded feature: ${req.file.filename}`]
        );
        res.json({ message: 'Feature uploaded and recorded successfully.', file: req.file.path });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error processing feature upload.' });
    }
});

// Commission Management
router.get('/commissions', checkSuperAdmin, async (req, res) => {
    const { status, userId } = req.query;

    try {
        let query = `
            SELECT c.*, u.name as affiliate_name, u.email as affiliate_email
            FROM commissions c
            JOIN users u ON c.user_id = u.id
        `;
        let params = [];

        if (status) {
            query += ' WHERE c.status = $1';
            params.push(status);
        }

        if (userId) {
            query += (params.length > 0 ? ' AND' : ' WHERE') + ' c.user_id = $' + (params.length + 1);
            params.push(userId);
        }

        query += ' ORDER BY c.created_at DESC';

        const commissions = await db.query(query, params);
        res.json(commissions.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching commissions' });
    }
});

// Approve Commission Payout
router.post('/approve-commission/:commissionId', checkSuperAdmin, async (req, res) => {
    const { commissionId } = req.params;

    try {
        const result = await db.query(
            'UPDATE commissions SET status = $1 WHERE id = $2 RETURNING *',
            ['paid', commissionId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Commission not found' });
        }

        // Log the approval
        await db.query(
            'INSERT INTO activities (message, created_at) VALUES ($1, NOW())',
            [`Commission payout approved: $${result.rows[0].amount} for user ${result.rows[0].user_id}`]
        );

        res.json({ message: 'Commission approved and marked as paid', commission: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error approving commission' });
    }
});

// Get Revenue Analytics for Admin
router.get('/revenue-analytics', checkSuperAdmin, async (req, res) => {
    try {
        // Total revenue
        const totalRevenue = await db.query('SELECT SUM(amount) FROM payments WHERE status = $1', ['completed']);

        // Total commissions paid
        const totalCommissions = await db.query('SELECT SUM(amount) FROM commissions WHERE status = $1', ['paid']);

        // Platform profit (revenue - commissions)
        const platformProfit = (parseFloat(totalRevenue.rows[0].sum || 0) - parseFloat(totalCommissions.rows[0].sum || 0));

        // Monthly breakdown
        const monthlyData = await db.query(`
            SELECT DATE_TRUNC('month', created_at) as month,
                   SUM(CASE WHEN table_name = 'payments' THEN amount ELSE 0 END) as revenue,
                   SUM(CASE WHEN table_name = 'commissions' THEN amount ELSE 0 END) as commissions
            FROM (
                SELECT created_at, amount, 'payments' as table_name FROM payments WHERE status = 'completed'
                UNION ALL
                SELECT created_at, amount, 'commissions' as table_name FROM commissions WHERE status = 'paid'
            ) combined
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month DESC
            LIMIT 12
        `);

        res.json({
            totalRevenue: totalRevenue.rows[0].sum || 0,
            totalCommissions: totalCommissions.rows[0].sum || 0,
            platformProfit: platformProfit,
            monthlyData: monthlyData.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching revenue analytics' });
    }
});

module.exports = router;
