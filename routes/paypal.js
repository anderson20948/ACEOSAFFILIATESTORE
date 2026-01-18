const express = require('express');
const router = express.Router();
const paypal = require('@paypal/checkout-server-sdk');
const { client, MERCHANT_CONFIG } = require('../paypalConfig');
const { pool } = require('../dbConfig');

// Create PayPal Order
router.post('/create-order', async (req, res) => {
    const { productId, affiliateId } = req.body;

    try {
        // Get product details
        const product = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
        if (product.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }

        const productData = product.rows[0];
        const price = parseFloat(productData.price);

        // Calculate amounts
        const affiliateCommission = price * MERCHANT_CONFIG.affiliateCommission;
        const platformFee = price * MERCHANT_CONFIG.platformFee;
        const merchantAmount = price - affiliateCommission - platformFee;

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'USD',
                    value: price.toFixed(2),
                    breakdown: {
                        item_total: {
                            currency_code: 'USD',
                            value: price.toFixed(2)
                        }
                    }
                },
                items: [{
                    name: productData.title,
                    description: productData.description?.substring(0, 127) || 'Affiliate Product',
                    quantity: '1',
                    unit_amount: {
                        currency_code: 'USD',
                        value: price.toFixed(2)
                    }
                }],
                payee: {
                    email_address: MERCHANT_CONFIG.email
                }
            }],
            application_context: {
                brand_name: 'Bamburi Affiliate Store',
                landing_page: 'BILLING',
                user_action: 'PAY_NOW',
                return_url: `${req.protocol}://${req.get('host')}/payment/success`,
                cancel_url: `${req.protocol}://${req.get('host')}/payment/cancel`
            }
        });

        const order = await client().execute(request);

        // Store order details temporarily
        await pool.query(
            'INSERT INTO payments (user_id, product_id, order_id, amount, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (order_id) DO UPDATE SET status = $5',
            [affiliateId || null, productId, order.result.id, price, 'pending']
        );

        res.json({
            success: true,
            orderId: order.result.id,
            orderData: order.result
        });

    } catch (err) {
        console.error('Error creating PayPal order:', err);
        res.status(500).json({ success: false, message: 'Failed to create payment order.' });
    }
});

// Capture PayPal Payment
router.post('/capture-order', async (req, res) => {
    const { orderId, affiliateId } = req.body;

    try {
        const request = new paypal.orders.OrdersCaptureRequest(orderId);
        const capture = await client().execute(request);

        if (capture.result.status === 'COMPLETED') {
            const captureId = capture.result.purchase_units[0].payments.captures[0].id;
            const payerId = capture.result.payer.payer_id;
            const amount = parseFloat(capture.result.purchase_units[0].amount.value);

            // Calculate commissions
            const affiliateCommission = amount * MERCHANT_CONFIG.affiliateCommission;
            const platformFee = amount * MERCHANT_CONFIG.platformFee;

            // Update payment record
            const paymentUpdate = await pool.query(
                'UPDATE payments SET payer_id = $1, payment_id = $2, status = $3 WHERE order_id = $4 RETURNING *',
                [payerId, captureId, 'completed', orderId]
            );

            // Create commission record for affiliate
            if (affiliateId && affiliateCommission > 0) {
                await pool.query(
                    'INSERT INTO commissions (user_id, amount, status) VALUES ($1, $2, $3)',
                    [affiliateId, affiliateCommission, 'pending']
                );
            }

            // Log platform fee (this would go to platform revenue)
            console.log(`Platform fee: $${platformFee.toFixed(2)} for order ${orderId}`);

            res.json({
                success: true,
                message: 'Payment completed successfully!',
                payment: paymentUpdate.rows[0],
                commission: affiliateCommission.toFixed(2)
            });
        } else {
            res.status(400).json({ success: false, message: 'Payment not completed.' });
        }

    } catch (err) {
        console.error('Error capturing PayPal payment:', err);
        res.status(500).json({ success: false, message: 'Failed to complete payment.' });
    }
});

// Legacy capture route for backward compatibility
router.post('/capture', async (req, res) => {
    const { orderID, payerID, paymentID, amount, productId, userId } = req.body;

    if (!orderID || !payerID || !paymentID || !amount || !productId) {
        return res.status(400).json({ success: false, message: 'Missing payment details.' });
    }

    try {
        // Update existing payment record or create new one
        const result = await pool.query(
            'INSERT INTO payments (user_id, product_id, order_id, payer_id, payment_id, amount, status) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (order_id) DO UPDATE SET payer_id = $4, payment_id = $5, status = $7 RETURNING *',
            [userId || null, productId, orderID, payerID, paymentID, amount, 'completed']
        );

        // Create affiliate commission if user provided
        if (userId && amount > 0) {
            const commission = parseFloat(amount) * MERCHANT_CONFIG.affiliateCommission;
            await pool.query(
                'INSERT INTO commissions (user_id, amount, status) VALUES ($1, $2, $3)',
                [userId, commission, 'pending']
            );
        }

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
