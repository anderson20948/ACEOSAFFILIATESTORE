const express = require('express');
const { wrapRouter } = require('../middleware/asyncHandler');
const router = wrapRouter(express.Router());
const { client, MERCHANT_CONFIG } = require('../paypalConfig');
const paypal = require('@paypal/checkout-server-sdk');
const { db } = require('../dbConfig');
const logger = require('../utils/logger');
const { verifyAdmin } = require('../middleware/auth');
const emailService = require('../services/emailService');

/**
 * Automate Bulk Payouts to Affiliates
 * Feature 3: Automation & Payouts
 */
router.post('/process-bulk', verifyAdmin, async (req, res) => {
    try {
        // 1. Get all pending commissions
        const { data: pendingCommissions, error: fetchError } = await db
            .from('commissions')
            .select('*, users(email, name)')
            .eq('status', 'pending');

        if (fetchError) throw fetchError;

        if (!pendingCommissions || pendingCommissions.length === 0) {
            return res.json({ success: true, message: 'No pending commissions to process.' });
        }

        // 2. Group by user for bulk payout
        const userPayouts = {};
        pendingCommissions.forEach(comm => {
            if (!userPayouts[comm.user_id]) {
                userPayouts[comm.user_id] = {
                    email: comm.users.email,
                    name: comm.users.name,
                    total: 0,
                    commissionIds: []
                };
            }
            userPayouts[comm.user_id].total += parseFloat(comm.amount);
            userPayouts[comm.user_id].commissionIds.push(comm.id);
        });

        const payoutItems = Object.keys(userPayouts).map(userId => ({
            recipient_type: 'EMAIL',
            amount: {
                value: userPayouts[userId].total.toFixed(2),
                currency: 'USD'
            },
            receiver: userPayouts[userId].email,
            note: 'Your affiliate commissions from Aceos Store',
            sender_item_id: `PAYOUT_${userId}_${Date.now()}`
        }));

        // 3. (Mock) Execute PayPal Payouts
        // Note: Real implementation would use the Payouts SDK
        // For this demo, we simulate success for all items
        logger.info(`Processing bulk payout for ${payoutItems.length} affiliates`, { payoutItems });

        // 4. Update commission status and notify users
        for (const userId of Object.keys(userPayouts)) {
            const data = userPayouts[userId];
            
            // Update commissions to 'paid'
            await db.from('commissions')
                .update({ status: 'paid', paid_at: new Date() })
                .in('id', data.commissionIds);

            // Notify user
            await emailService.sendPaymentProcessed(data.email, data.name, data.total, `BATCH_${Date.now()}`);
        }

        res.json({
            success: true,
            message: `Successfully processed payouts for ${Object.keys(userPayouts).length} affiliates.`,
            totalProcessed: Object.values(userPayouts).reduce((sum, u) => sum + u.total, 0).toFixed(2)
        });

    } catch (err) {
        logger.error('Bulk payout error:', err);
        res.status(500).json({ success: false, error: 'Failed to process bulk payouts' });
    }
});

module.exports = router;
