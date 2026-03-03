const express = require('express');
const router = express.Router();
const { db } = require('../dbConfig');
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
        const { data: products, error } = await db
            .from('products')
            .select('*')
            .eq('status', 'pending');

        if (error) throw error;
        res.json(products);
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
        const { data: result, error } = await db
            .from('products')
            .update({ status })
            .eq('id', productId)
            .select('*');

        if (error) throw error;
        res.json({ message: `Product ${status}`, product: result[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating product status' });
    }
});

// Get Admin Statistics
router.get('/stats', async (req, res) => {
    try {
        const { count: userCount } = await db.from('users').select('*', { count: 'exact', head: true });
        const { data: payments } = await db.from('payments').select('amount');
        const totalRevenue = payments ? payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0) : 0;
        const { count: clickCount } = await db.from('traffic_logs').select('*', { count: 'exact', head: true });
        const { count: pendingProducts } = await db.from('products').select('*', { count: 'exact', head: true }).eq('status', 'pending');

        res.json({
            totalUsers: userCount,
            totalRevenue: totalRevenue,
            totalClicks: clickCount,
            pendingApprovals: pendingProducts
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching stats' });
    }
});

// Get Payment History
router.get('/payments', async (req, res) => {
    try {
        const { data: payments, error } = await db
            .from('payments')
            .select('*, users(name), products(title)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Map to expected format
        const mappedPayments = payments.map(p => ({
            ...p,
            username: p.users?.name,
            product_title: p.products?.title
        }));

        res.json(mappedPayments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching payments' });
    }
});

// Get User Listing
router.get('/users', async (req, res) => {
    try {
        const { data: users, error } = await db
            .from('users')
            .select('id, name, email, role, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Map 'name' to 'username' as expected by frontend
        const mappedUsers = users.map(u => ({ ...u, username: u.name }));
        res.json(mappedUsers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching users' });
    }
});

// Get System Activities
router.get('/activities', async (req, res) => {
    try {
        const { data: activities, error } = await db
            .from('system_logs')
            .select('*, users(name)')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        const mappedActivities = activities.map(a => ({
            ...a,
            username: a.users?.name
        }));

        res.json(mappedActivities);
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
        const { error } = await db
            .from('system_logs')
            .insert([
                { user_id: req.user.id, activity_type: 'json_execute', details: `Executed config: ${JSON.stringify(config).substring(0, 100)}...` }
            ]);

        if (error) throw error;

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
        const { error } = await db
            .from('system_logs')
            .insert([
                { user_id: req.user.id, activity_type: 'feature_upload', details: `Uploaded feature: ${req.file.filename}` }
            ]);

        if (error) throw error;
        res.json({ message: 'Feature uploaded and recorded successfully.', file: req.file.path });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error processing feature upload.' });
    }
});

// Commission Management
router.get('/commissions', async (req, res) => {
    const { status, userId } = req.query;

    try {
        let query = db.from('commissions').select('*, users(name, email)');

        if (status) {
            query = query.eq('status', status);
        }

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data: commissions, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        const mappedCommissions = commissions.map(c => ({
            ...c,
            affiliate_name: c.users?.name,
            affiliate_email: c.users?.email
        }));

        res.json(mappedCommissions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching commissions' });
    }
});

// Approve Commission Payout
router.post('/approve-commission/:commissionId', async (req, res) => {
    const { commissionId } = req.params;

    try {
        const { data: result, error } = await db
            .from('commissions')
            .update({ status: 'paid' })
            .eq('id', commissionId)
            .select('*');

        if (error) throw error;

        if (result.length === 0) {
            return res.status(404).json({ error: 'Commission not found' });
        }

        // Log the approval
        await db.from('activities').insert([
            { message: `Commission payout approved: $${result[0].amount} for user ${result[0].user_id}`, created_at: new Date() }
        ]);

        res.json({ message: 'Commission approved and marked as paid', commission: result[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error approving commission' });
    }
});

// Get Revenue Analytics for Admin
router.get('/revenue-analytics', async (req, res) => {
    try {
        // Total revenue
        const { data: payments } = await db.from('payments').select('amount').eq('status', 'completed');
        const totalRevenue = payments ? payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0) : 0;

        // Total commissions paid
        const { data: commissions } = await db.from('commissions').select('amount').eq('status', 'paid');
        const totalCommissions = commissions ? commissions.reduce((acc, c) => acc + parseFloat(c.amount || 0), 0) : 0;

        // Platform profit (revenue - commissions)
        const platformProfit = totalRevenue - totalCommissions;

        // Monthly breakdown - This is complex with Supabase client alone
        // For simplicity, we'll return a mock or simplified aggregate
        // In a real scenario, you'd use a Supabase RPC or more client-side processing

        res.json({
            totalRevenue: totalRevenue,
            totalCommissions: totalCommissions,
            platformProfit: platformProfit,
            monthlyData: [] // Simplified for now
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching revenue analytics' });
    }
});

module.exports = router;
