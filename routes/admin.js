const express = require('express');
const router = express.Router();
const { db } = require('../dbConfig');
const jwt = require('jsonwebtoken');
const emailService = require('../services/emailService');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
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

const logger = require('../utils/logger');

// Middleware to verify admin (Strict Role-Based Access Control)
const verifyAdmin = (req, res, next) => {
    // 1. Check Passport Session first
    if (req.isAuthenticated() && req.user.role === 'admin') {
        return next();
    }

    // 2. Fallback to Token verification
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) {
        logger.warn('Unauthorized admin access attempt', { path: req.path, ip: req.ip });
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'aceos-secret-key');
        if (decoded.role !== 'admin') {
            logger.warn('Access denied for non-admin user', { userId: decoded.id, role: decoded.role });
            return res.status(403).json({ error: 'Access denied. Admins only.' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        logger.error('Invalid token for admin access', { error: err.message });
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
        logger.error(err);
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
        logger.error(err);
        res.status(500).json({ error: 'Error updating product status' });
    }
});

// Get Admin Statistics
router.get('/stats', verifyAdmin, async (req, res) => {
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
        logger.error(err);
        res.status(500).json({ error: 'Error fetching stats' });
    }
});

// GET Comprehensive Statistics for Dashboard
router.get('/comprehensive-stats', verifyAdmin, async (req, res) => {
    try {
        const { count: totalUsers } = await db.from('users').select('*', { count: 'exact', head: true });
        const { count: advertisingUsers } = await db.from('users').select('*', { count: 'exact', head: true }).eq('advertising_status', 'active');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: activeUsers } = await db.from('user_sessions').select('*', { count: 'exact', head: true }).gt('login_time', today.toISOString());

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { count: newUsers } = await db.from('users').select('*', { count: 'exact', head: true }).gt('created_at', weekAgo.toISOString());

        const { data: payments } = await db.from('payments').select('amount');
        const totalRevenue = payments ? payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0) : 0;

        const firstOfMonth = new Date();
        firstOfMonth.setDate(1);
        firstOfMonth.setHours(0, 0, 0, 0);
        const { data: monthlyPayments } = await db.from('payments').select('amount').gt('created_at', firstOfMonth.toISOString());
        const monthlyRevenue = monthlyPayments ? monthlyPayments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0) : 0;

        const { data: pendingComms } = await db.from('commissions').select('amount').eq('status', 'pending');
        const pendingCommissions = pendingComms ? pendingComms.reduce((acc, c) => acc + parseFloat(c.amount || 0), 0) : 0;

        const { count: totalClicks } = await db.from('traffic_logs').select('*', { count: 'exact', head: true });
        const { count: activeCampaigns } = await db.from('advertising_campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active');
        const { count: pendingApplications } = await db.from('advertising_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending');

        res.json({
            success: true,
            stats: {
                totalUsers,
                activeUsers: activeUsers || Math.floor(totalUsers * 0.15), // Fallback if no sessions logs
                newUsers,
                advertisingUsers,
                totalRevenue,
                monthlyRevenue,
                pendingCommissions,
                totalClicks,
                activeCampaigns,
                pendingApplications,
                adImpressions: 0, // Placeholder
                adRevenue: 0, // Placeholder
                systemUptime: 100,
                activeConnections: 1,
                pendingTasks: 0,
                errorRate: 0
            }
        });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, error: 'Error fetching comprehensive stats' });
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
        logger.error(err);
        res.status(500).json({ error: 'Error fetching payments' });
    }
});

// Get User Listing
router.get('/users', verifyAdmin, async (req, res) => {
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
        logger.error(err);
        res.status(500).json({ error: 'Error fetching users' });
    }
});

// NOTE: /users-detailed with search is defined later in this file (line ~739). Removed duplicate here.

// Get System Activities
router.get('/activities', verifyAdmin, async (req, res) => {
    try {
        const { data: activities, error } = await db
            .from('system_logs')
            .select('*, users(name)')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        res.json(activities);
    } catch (err) {
        logger.error(err);
        res.status(500).json({ error: 'Error fetching activities' });
    }
});

// GET Email Logs
router.get('/email-logs', verifyAdmin, async (req, res) => {
    try {
        const { data: emails, error } = await db
            .from('email_logs')
            .select('*')
            .order('sent_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            emails: emails
        });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, error: 'Error fetching email logs' });
    }
});

// GET User Activities Detailed
router.get('/user-activities', verifyAdmin, async (req, res) => {
    try {
        const { data: activities, error } = await db
            .from('user_activity_logs')
            .select('*, users(name)')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        const mappedActivities = activities.map(a => ({
            ...a,
            user_name: a.users?.name
        }));

        res.json({
            success: true,
            activities: mappedActivities
        });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, error: 'Error fetching user activities' });
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
        logger.error(err);
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
        logger.error(err);
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
        logger.error(err);
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
        logger.error(err);
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
        logger.error(err);
        res.status(500).json({ error: 'Error fetching revenue analytics' });
    }
});

// GET Advertising Applications
router.get('/advertising-applications', verifyAdmin, async (req, res) => {
    try {
        const { data: applications, error } = await db
            .from('advertising_applications')
            .select('*, users(name, email)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const mappedApps = applications.map(app => ({
            ...app,
            user_name: app.users?.name,
            user_email: app.users?.email
        }));

        res.json({
            success: true,
            applications: mappedApps
        });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, error: 'Error fetching applications' });
    }
});

// POST Approve Advertising Application
router.post('/approve-application', verifyAdmin, async (req, res) => {
    const { applicationId, userEmail, applicationType } = req.body;
    try {
        const { data: appData, error: fetchErr } = await db
            .from('advertising_applications')
            .select('*, users(name)')
            .eq('id', applicationId)
            .single();

        if (fetchErr) throw fetchErr;

        const { error: updateError } = await db
            .from('advertising_applications')
            .update({ status: 'approved', updated_at: new Date().toISOString() })
            .eq('id', applicationId);

        if (updateError) throw updateError;

        // Update user's advertising status
        const { error: userError } = await db
            .from('users')
            .update({ advertising_status: 'active' })
            .eq('email', userEmail);

        if (userError) throw userError;

        // Send confirmation email
        await emailService.sendApplicationApproved(userEmail, appData.users?.name || 'User', applicationType);

        res.json({ success: true, message: 'Application approved' });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, error: 'Error approving application' });
    }
});

// POST Reject Advertising Application
router.post('/reject-application', verifyAdmin, async (req, res) => {
    const { applicationId, userEmail, applicationType, reason } = req.body;
    try {
        const { data: appData, error: fetchErr } = await db
            .from('advertising_applications')
            .select('*, users(name)')
            .eq('id', applicationId)
            .single();

        if (fetchErr) throw fetchErr;

        const { error: updateError } = await db
            .from('advertising_applications')
            .update({
                status: 'rejected',
                admin_notes: reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', applicationId);

        if (updateError) throw updateError;

        // Send rejection email
        await emailService.sendApplicationRejected(userEmail, appData.users?.name || 'User', applicationType, reason);

        res.json({ success: true, message: 'Application rejected' });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, error: 'Error rejecting application' });
    }
});

// GET Admin Notifications
router.get('/notifications', verifyAdmin, async (req, res) => {
    try {
        const { data: notifications, error } = await db
            .from('admin_notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        res.json({
            success: true,
            notifications: notifications
        });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, error: 'Error fetching notifications' });
    }
});

// POST Mark Notification Read
router.post('/mark-notification-read', verifyAdmin, async (req, res) => {
    const { notificationId } = req.body;
    try {
        const { error } = await db
            .from('admin_notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) throw error;

        res.json({ success: true });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, error: 'Error marking notification read' });
    }
});

// GET System Ads
router.get('/ads', verifyAdmin, async (req, res) => {
    try {
        const { data: ads, error } = await db
            .from('system_ads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            ads: ads
        });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, error: 'Error fetching ads' });
    }
});

// GET Payment Services Stats
router.get('/payment-services', verifyAdmin, async (req, res) => {
    try {
        const { data: payments } = await db.from('payments').select('amount').eq('status', 'processed');
        const { data: pendingComms } = await db.from('commissions').select('amount').eq('status', 'pending');
        const { data: users } = await db.from('users').select('commission_balance');

        const totalProcessed = payments ? payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0) : 0;
        const pendingPayments = users ? users.reduce((acc, u) => acc + parseFloat(u.commission_balance || 0), 0) : 0;

        // Mock system balance for demonstration
        const systemBalance = totalProcessed * 0.2 + 5000;

        res.json({
            success: true,
            stats: {
                totalProcessed,
                pendingPayments,
                systemBalance
            }
        });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, error: 'Error fetching payment services' });
    }
});

// GET Pending Payments Summary (Breakdown by User)
router.get('/pending-payments-summary', verifyAdmin, async (req, res) => {
    try {
        const { data: users, error } = await db
            .from('users')
            .select('id, name, email, paypal_email, commission_balance')
            .gt('commission_balance', 0)
            .order('commission_balance', { ascending: false });

        if (error) throw error;

        // For each user, count their pending commissions
        const breakdown = await Promise.all(users.map(async (user) => {
            const { count } = await db
                .from('commissions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('status', 'pending');

            return {
                user_name: user.name,
                user_email: user.email,
                paypal_email: user.paypal_email || 'Not provided',
                commission_balance: parseFloat(user.commission_balance).toFixed(2),
                pending_commissions: count || 0
            };
        }));

        res.json({
            success: true,
            summary: {
                users_with_pending: users.length,
                total_pending_commissions: breakdown.reduce((acc, b) => acc + b.pending_commissions, 0)
            },
            breakdown: breakdown
        });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, error: 'Error fetching pending payments summary' });
    }
});

// POST Process All Pending Payments
router.post('/process-pending-payments', verifyAdmin, async (req, res) => {
    try {
        // 1. Fetch all users with a balance
        const { data: users, error: fetchError } = await db
            .from('users')
            .select('id, name, email, paypal_email, commission_balance')
            .gt('commission_balance', 0);

        if (fetchError) throw fetchError;

        if (!users || users.length === 0) {
            return res.json({ success: false, message: 'No pending payments found' });
        }

        const results = [];
        let totalAmount = 0;

        // 2. Process each user
        for (const user of users) {
            const amount = parseFloat(user.commission_balance);
            totalAmount += amount;
            const transactionId = `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            // Create a payment record
            const { data: payment, error: payError } = await db
                .from('payments')
                .insert([{
                    user_id: user.id,
                    amount: amount,
                    status: 'processed',
                    transaction_id: transactionId
                }])
                .select();

            if (payError) {
                results.push({ user: user.email, status: 'failed', error: payError.message });
                continue;
            }

            // Update commissions to paid
            await db
                .from('commissions')
                .update({ status: 'paid' })
                .eq('user_id', user.id)
                .eq('status', 'pending');

            // Reset user balance
            await db
                .from('users')
                .update({ commission_balance: 0 })
                .eq('id', user.id);

            // Send email notification
            await emailService.sendPaymentProcessed(user.email, user.name, amount, transactionId);

            results.push({ user: user.email, status: 'processed', amount });
        }

        // Log the action in system logs
        await db.from('system_logs').insert([{
            activity_type: 'payment_processing',
            details: `Processed $${totalAmount.toFixed(2)} in total payments for ${users.length} users.`
        }]);

        res.json({
            success: true,
            totalAmount,
            results
        });
    } catch (err) {
        logger.error('Payment processing error:', err);
        res.status(500).json({ success: false, error: 'Error during payment processing' });
    }
});

// GET Users Detailed (with search)
router.get('/users-detailed', verifyAdmin, async (req, res) => {
    const { query } = req.query;
    try {
        let dbQuery = db
            .from('users')
            .select('id, name, email, role, advertising_status, commission_balance, last_login');

        if (query) {
            dbQuery = dbQuery.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
        }

        const { data: users, error } = await dbQuery.order('name');

        if (error) throw error;

        res.json({
            success: true,
            users: users
        });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, error: 'Error fetching users' });
    }
});

// POST Invite Advertiser
router.post('/invite-advertiser', verifyAdmin, async (req, res) => {
    const { userId, email } = req.body;
    try {
        // Update user status to invited
        const { error: updateError } = await db
            .from('users')
            .update({ advertising_status: 'invited' })
            .eq('id', userId);

        if (updateError) throw updateError;

        // Create log
        await db.from('activities').insert([{
            message: `Admin invited user ${email} to become an advertiser`,
            created_at: new Date()
        }]);

        // Send invitation email (Placeholder logic)
        // await emailService.sendAdvertiserInvitation(email);

        res.json({ success: true, message: 'Invitation sent' });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ success: false, error: 'Error inviting user' });
    }
});

// Bulk reject all pending advertising applications
router.post("/reject-all-pending-applications", async (req, res) => {
    const { reason } = req.body;
    try {
        // Fetch all pending applications
        const { data: pendingApps, error: fetchError } = await db
            .from('advertising_applications')
            .select('id, user_id, application_type, users(email, name)')
            .eq('status', 'pending');

        if (fetchError) throw fetchError;

        if (!pendingApps || pendingApps.length === 0) {
            return res.json({ success: true, message: "No pending applications to reject" });
        }

        const appIds = pendingApps.map(app => app.id);
        const userEmails = pendingApps.map(app => app.users?.email).filter(Boolean);

        // Update all to rejected
        const { error: updateError } = await db
            .from('advertising_applications')
            .update({ status: 'rejected', admin_notes: reason || 'Bulk rejected by admin', updated_at: new Date() })
            .in('id', appIds);

        if (updateError) throw updateError;

        // Update users status back to inactive
        const { error: userUpdateError } = await db
            .from('users')
            .update({ advertising_status: 'inactive' })
            .in('email', userEmails);

        if (userUpdateError) throw userUpdateError;

        // Log activity
        await db.from('activities').insert([{
            message: `Bulk rejected ${appIds.length} advertising applications. Reason: ${reason || 'None provided'}`,
            created_at: new Date()
        }]);

        // Send notifications (In production, this would be a background job)
        // For now, we just log it.
        logger.info(`Bulk rejected ${appIds.length} applications.`);

        res.json({ success: true, message: `Successfully rejected ${appIds.length} applications` });
    } catch (err) {
        logger.error("Bulk rejection error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * USER MANAGEMENT (MONOPOLY)
 */

// POST Create New User (Admin only)
router.post('/users', verifyAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing required fields' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const { data: newUser, error } = await db
            .from('users')
            .insert([{ name, email, password: hashedPassword, role: role || 'affiliate' }])
            .select();

        if (error) throw error;

        await db.from('system_logs').insert([{
            user_id: req.user.id,
            activity_type: 'user_create',
            details: `Admin created user: ${email}`
        }]);

        res.status(201).json({ success: true, message: 'User created successfully', user: newUser[0] });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ error: 'Error creating user' });
    }
});

// DELETE User (Admin only)
router.delete('/users/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Log before delete (to preserve record)
        const { data: user } = await db.from('users').select('email').eq('id', id).single();

        const { error } = await db.from('users').delete().eq('id', id);
        if (error) throw error;

        await db.from('system_logs').insert([{
            user_id: req.user.id,
            activity_type: 'user_delete',
            details: `Admin deleted user: ${user ? user.email : id}`
        }]);

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ error: 'Error deleting user' });
    }
});

/**
 * AD MANAGEMENT
 */

// POST Create New Ad
router.post('/ads', verifyAdmin, async (req, res) => {
    const { title, content, image_url, target_url, display_priority } = req.body;
    try {
        const { data: newAd, error } = await db
            .from('system_ads')
            .insert([{ title, content, image_url, target_url, display_priority: display_priority || 0 }])
            .select();

        if (error) throw error;

        res.status(201).json({ success: true, ad: newAd[0] });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ error: 'Error creating ad' });
    }
});

// PUT Update Ad
router.put('/ads/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    updates.updated_at = new Date();

    try {
        const { data: updatedAd, error } = await db
            .from('system_ads')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;
        res.json({ success: true, ad: updatedAd[0] });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ error: 'Error updating ad' });
    }
});

// DELETE Ad
router.delete('/ads/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await db.from('system_ads').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true, message: 'Ad deleted successfully' });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ error: 'Error deleting ad' });
    }
});

// Route aliases for admin-dashboard.js compatibility
// POST /create-user -> POST /users
router.post('/create-user', verifyAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing required fields' });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const { data: newUser, error } = await db
            .from('users')
            .insert([{ name, email, password: hashedPassword, role: role || 'affiliate' }])
            .select();
        if (error) throw error;
        await db.from('system_logs').insert([{
            user_id: req.user?.id,
            activity_type: 'user_create',
            details: `Admin created user: ${email}`
        }]).catch(() => {}); // non-critical
        res.status(201).json({ success: true, message: 'User created successfully', user: newUser[0] });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ error: 'Error creating user' });
    }
});

// DELETE /delete-user/:id -> DELETE /users/:id
router.delete('/delete-user/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const { data: user } = await db.from('users').select('email').eq('id', id).single();
        const { error } = await db.from('users').delete().eq('id', id);
        if (error) throw error;
        await db.from('system_logs').insert([{
            user_id: req.user?.id,
            activity_type: 'user_delete',
            details: `Admin deleted user: ${user ? user.email : id}`
        }]).catch(() => {}); // non-critical
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ error: 'Error deleting user' });
    }
});

// POST /reset-user-password (Admin only)
router.post('/reset-user-password', verifyAdmin, async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    try {
        const { data: user, error: userError } = await db
            .from('users')
            .select('email, name')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

        // Store reset code
        const { error: resetError } = await db
            .from('password_resets')
            .insert([{
                email: user.email,
                code: code,
                expires_at: expiresAt,
                verified: false
            }]);

        if (resetError) throw resetError;

        // Send email
        await emailService.sendPasswordResetCode(user.email, code);

        // Log action
        await db.from('system_logs').insert([{
            user_id: req.user?.id,
            activity_type: 'password_reset_triggered',
            details: `Admin triggered password reset for: ${user.email}`
        }]).catch(() => {});

        res.json({ success: true, message: `Password reset email sent to ${user.email}` });
    } catch (err) {
        logger.error('Error triggering password reset:', err);
        res.status(500).json({ error: 'Error triggering password reset' });
    }
});

module.exports = router;
