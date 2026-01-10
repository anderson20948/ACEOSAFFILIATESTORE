const express = require('express');
const router = express.Router();
const db = require('../db');

// Route to capture PayPal payment and store in DB
router.post('/capture', async (req, res) => {
    const { orderID, payerID, paymentID, amount, productId, userId } = req.body;

    if (!orderID || !payerID || !paymentID || !amount || !productId) {
        return res.status(400).json({ success: false, message: 'Missing payment details.' });
    }

    try {
        // Store transaction in the database
        const result = await db.query(
            'INSERT INTO payments (user_id, product_id, order_id, payer_id, payment_id, amount, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [userId || null, productId, orderID, payerID, paymentID, amount, 'completed']
        );

        res.json({
            success: true,
            message: 'Payment recorded successfully.',
            payment: result.rows[0]
        });
    } catch (err) {
        console.error('Error recording payment:', err);
        res.status(500).json({ success: false, message: 'Internal server error while recording payment.' });
    }
});

module.exports = router;
