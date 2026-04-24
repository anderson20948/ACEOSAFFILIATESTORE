const express = require('express');
const { wrapRouter } = require('../middleware/asyncHandler');
const router = wrapRouter(express.Router());
const paypal = require('@paypal/checkout-server-sdk');
const { client, MERCHANT_CONFIG } = require('../paypalConfig');
const { db } = require('../dbConfig');
const logger = require('../utils/logger');
const crypto = require('crypto');
const emailService = require('../services/emailService');

// Create PayPal Order
router.post('/create-order', async (req, res) => {
    const { productId, affiliateId, couponCode } = req.body;

    try {
        // Get product details
        const { data: products, error: fetchError } = await db
            .from('products')
            .select('*')
            .eq('id', productId);

        if (fetchError) throw fetchError;
        if (products.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }

        const productData = products[0];
        let price = parseFloat(productData.price);
        let finalAffiliateId = affiliateId;

        // --- FEATURE: Coupon Code Tracking & Discounts ---
        if (couponCode) {
            const { data: coupon, error: couponError } = await db
                .from('coupons')
                .select('*, users(id)')
                .eq('code', couponCode.toUpperCase())
                .eq('is_active', true)
                .single();

            if (coupon && !couponError) {
                // Apply discount
                const discount = price * (parseFloat(coupon.discount_percent) / 100);
                price -= discount;
                
                // Attribute commission to coupon owner
                finalAffiliateId = coupon.user_id;
                
                logger.info(`Coupon ${couponCode} applied. Discount: ${discount.toFixed(2)}. Affiliate: ${finalAffiliateId}`);
            }
        }

        // Calculate amounts based on final price
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
        const { error: upsertError } = await db
            .from('payments')
            .upsert({
                user_id: finalAffiliateId || null,
                product_id: productId,
                order_id: order.result.id,
                amount: price,
                status: 'pending',
                created_at: new Date()
            }, { onConflict: 'order_id' });

        if (upsertError) throw upsertError;

        res.json({
            success: true,
            orderId: order.result.id,
            orderData: order.result
        });

    } catch (err) {
        logger.error('Error creating PayPal order', { error: err.message, productId });
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
            const { data: paymentUpdate, error: updateError } = await db
                .from('payments')
                .update({ payer_id: payerId, payment_id: captureId, status: 'completed' })
                .eq('order_id', orderId)
                .select("*");

            if (updateError) throw updateError;

            // Create commission record for affiliate
            if (affiliateId && affiliateCommission > 0) {
                const { error: commissionError } = await db
                    .from('commissions')
                    .insert([
                        { user_id: affiliateId, amount: affiliateCommission, status: 'pending' }
                    ]);

                if (commissionError) throw commissionError;
            }

            logger.info(`Payment completed successfully for order ${orderId}`, { captureId, amount });

            res.json({
                success: true,
                message: 'Payment completed successfully!',
                payment: paymentUpdate[0],
                commission: affiliateCommission.toFixed(2)
            });
        } else {
            res.status(400).json({ success: false, message: 'Payment not completed.' });
        }

    } catch (err) {
        logger.error('Error capturing PayPal payment', { error: err.message, orderId });
        res.status(500).json({ success: false, message: 'Failed to complete payment.' });
    }
});

// Legacy capture route for backward compatibility (Supports both PayPal and Google Pay)
router.post('/capture', async (req, res) => {
    const { orderID, payerID, paymentID, amount, productId, userId, paymentMethod } = req.body;

    if (!orderID || !payerID || !paymentID || !amount || !productId) {
        return res.status(400).json({ success: false, message: 'Missing payment details.' });
    }

    try {
        // Update existing payment record or create new one
        const { data: result, error: upsertError } = await db
            .from('payments')
            .upsert({
                user_id: userId || null,
                product_id: productId,
                order_id: orderID,
                payer_id: payerID,
                payment_id: paymentID,
                amount: amount,
                payment_method: paymentMethod || 'paypal',
                status: 'completed'
            }, { onConflict: 'order_id' })
            .select("*");

        if (upsertError) throw upsertError;

        // Create affiliate commission if user provided AND payment was not already completed
        if (userId && amount > 0) {
            // Check if commission already exists for this order
            const { data: existingCommission } = await db
                .from('commissions')
                .select('id')
                .eq('order_id', orderID);

            if (!existingCommission || existingCommission.length === 0) {
                const commission = parseFloat(amount) * MERCHANT_CONFIG.affiliateCommission;
                const { error: commissionError } = await db
                    .from('commissions')
                    .insert([
                        { user_id: userId, order_id: orderID, amount: commission, status: 'pending' }
                    ]);

                if (commissionError) logger.error('Error recording commission', { error: commissionError.message, orderID });
            }
        }

        logger.info(`Legacy payment recorded successfully for order ${orderID}`, { paymentID });

        res.json({
            success: true,
            message: 'Payment recorded successfully.',
            payment: result[0]
        });
    } catch (err) {
        logger.error('Error recording payment', { error: err.message, orderID });
        res.status(500).json({ success: false, message: 'Internal server error while recording payment.' });
    }
});

/**
 * PayPal Webhook Listener
 * Verifies the signature from PayPal before processing
 */
router.post('/webhook', async (req, res) => {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const headers = req.headers;
    const eventBody = req.body;

    // Check if webhook ID is configured
    if (!webhookId) {
        logger.error('PAYPAL_WEBHOOK_ID not configured - webhook verification impossible');
        return res.status(500).send('Webhook configuration error');
    }

    try {
        // Verify the webhook signature
        const isValid = await verifyPayPalWebhook(headers, eventBody, webhookId);

        if (!isValid) {
            logger.warn('Invalid PayPal webhook signature', {
                transmissionId: headers['paypal-transmission-id'],
                eventType: eventBody?.event_type
            });
            return res.status(400).send('Invalid webhook signature');
        }

        logger.info('PayPal Webhook verified successfully', {
            eventType: eventBody.event_type,
            eventId: eventBody.id,
            transmissionId: headers['paypal-transmission-id']
        });

        // Process the verified webhook event
        await processWebhookEvent(eventBody);

        res.status(200).send('Webhook processed successfully');

    } catch (err) {
        logger.error('Webhook processing failed', {
            error: err.message,
            eventType: eventBody?.event_type,
            transmissionId: headers['paypal-transmission-id']
        });
        res.status(500).send('Internal Server Error');
    }
});

/**
 * Verify PayPal webhook signature manually
 * PayPal uses HMAC-SHA256 signature verification
 */
async function verifyPayPalWebhook(headers, eventBody, webhookId) {
    try {
        const transmissionId = headers['paypal-transmission-id'];
        const transmissionTime = headers['paypal-transmission-time'];
        const transmissionSig = headers['paypal-transmission-sig'];
        const certUrl = headers['paypal-cert-url'];
        const authAlgo = headers['paypal-auth-algo'];

        // Ensure all required headers are present
        if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
            logger.warn('Missing required PayPal webhook headers');
            return false;
        }

        // For now, we'll implement basic verification
        // In production, you should verify the certificate and signature properly
        // This is a simplified version for demonstration

        // Get the webhook secret from environment (you need to set this)
        const webhookSecret = process.env.PAYPAL_WEBHOOK_SECRET;

        if (!webhookSecret) {
            logger.error('PAYPAL_WEBHOOK_SECRET not configured');
            return false;
        }

        // Create the signature string
        const body = JSON.stringify(eventBody);
        const crc32 = require('crc-32');
        const crc = crc32.str(body);

        const signatureString = `${transmissionId}|${transmissionTime}|${webhookId}|${crc}`;

        // Calculate expected signature
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(signatureString)
            .digest('hex');

        // Compare signatures (PayPal sends multiple signatures separated by comma)
        const signatures = transmissionSig.split(',');
        const isValid = signatures.some(sig => sig.trim() === expectedSignature);

        if (!isValid) {
            logger.warn('Webhook signature verification failed', {
                expected: expectedSignature,
                received: transmissionSig
            });
        }

        return isValid;

    } catch (err) {
        logger.error('Error during webhook verification', { error: err.message });
        return false;
    }
}

/**
 * Process verified PayPal webhook events
 */
async function processWebhookEvent(webhookEvent) {
    const eventType = webhookEvent.event_type;
    const resource = webhookEvent.resource;

    try {
        switch (eventType) {
            case 'PAYMENT.CAPTURE.COMPLETED':
                await handlePaymentCaptureCompleted(resource);
                break;

            case 'PAYMENT.CAPTURE.DENIED':
                await handlePaymentCaptureDenied(resource);
                break;

            case 'PAYMENT.CAPTURE.REFUNDED':
                await handlePaymentCaptureRefunded(resource);
                break;

            case 'CHECKOUT.ORDER.APPROVED':
                await handleOrderApproved(resource);
                break;

            default:
                logger.info('Unhandled webhook event type', { eventType });
        }
    } catch (err) {
        logger.error('Error processing webhook event', {
            error: err.message,
            eventType,
            resourceId: resource?.id
        });
        throw err;
    }
}

/**
 * Handle successful payment capture
 */
async function handlePaymentCaptureCompleted(resource) {
    const captureId = resource.id;
    const orderId = resource.supplementary_data?.related_ids?.order_id;
    const amount = parseFloat(resource.amount?.value);

    if (!orderId) {
        logger.warn('Payment capture completed but no order ID found', { captureId });
        return;
    }

    logger.info('Processing payment capture completion', { orderId, captureId, amount });

    // Update payment status
    const { data: paymentUpdate, error: updateError } = await db
        .from('payments')
        .update({
            payment_id: captureId,
            status: 'completed'
        })
        .eq('order_id', orderId)
        .select("*");

    if (updateError) {
        logger.error('Failed to update payment status', { error: updateError.message, orderId });
        throw updateError;
    }

    if (!paymentUpdate || paymentUpdate.length === 0) {
        logger.warn('No payment record found for order', { orderId });
        return;
    }

    const payment = paymentUpdate[0];

    // Calculate and create commission if affiliate involved
    if (payment.user_id && amount > 0) {
        // --- FRAUD PREVENTION: Identification of Suspicious Leads ---
        // 1. Check Time-to-Conversion (TTC)
        const ttc = Date.now() - new Date(payment.created_at).getTime();
        let isSuspicious = false;
        let fraudReason = '';

        if (ttc < 3000) { // Less than 3 seconds between click and capture? Extremely unlikely for a human.
            isSuspicious = true;
            fraudReason = 'Abnormally fast conversion (Bot behavior)';
        }

        // --- FEATURE: Advanced Commission Logic (Flat, %, Tiered) ---
        const { data: affiliate } = await db.from('users').select('*, affiliate_tiers(*)').eq('id', payment.user_id).single();
        const { data: product } = await db.from('products').select('*').eq('id', payment.product_id).single();

        let baseCommission = 0;
        if (product.commission_type === 'flat') {
            baseCommission = parseFloat(product.flat_commission_amount || 0);
        } else {
            // Default to percentage
            const rate = parseFloat(product.commission_rate || MERCHANT_CONFIG.affiliateCommission * 100) / 100;
            baseCommission = amount * rate;
        }

        // Apply Tier Multiplier if exists
        let multiplier = 1.0;
        if (affiliate && affiliate.affiliate_tiers) {
            multiplier = parseFloat(affiliate.affiliate_tiers.commission_multiplier || 1.0);
        } else if (affiliate) {
            // Auto-Tier detection (Scalability Feature)
            const { data: tiers } = await db.from('affiliate_tiers').select('*').order('threshold_earnings', 'desc');
            const totalEarned = parseFloat(affiliate.commission_balance || 0);
            const currentTier = tiers.find(t => totalEarned >= parseFloat(t.threshold_earnings));
            if (currentTier) multiplier = parseFloat(currentTier.commission_multiplier);
        }

        const finalCommission = baseCommission * multiplier;

        // Check if commission already exists
        const { data: existingCommission } = await db
            .from('commissions')
            .select('id')
            .eq('order_id', orderId);

        if (!existingCommission || existingCommission.length === 0) {
            const { error: commissionError } = await db
                .from('commissions')
                .insert([{
                    user_id: payment.user_id,
                    order_id: orderId,
                    amount: finalCommission,
                    status: isSuspicious ? 'on-hold' : 'pending',
                    fraud_flag: isSuspicious,
                    fraud_reason: fraudReason
                }]);

            if (commissionError) throw commissionError;

            // Only update user balance if NOT suspicious (confirmed commissions only)
            if (!isSuspicious) {
                await db.from('users').update({ 
                    commission_balance: (parseFloat(affiliate.commission_balance || 0) + finalCommission)
                }).eq('id', payment.user_id);

                // Notify Affiliate (Performance Notification)
                await emailService.sendSaleNotification(affiliate.email, affiliate.name, finalCommission);
            } else {
                logger.warn('Commission placed on hold (Suspicious Activity)', { orderId, reason: fraudReason });
                
                // Notify Admin
                await db.from('admin_notifications').insert([{
                    notification_type: 'fraud_alert',
                    title: 'Suspicious Commission Blocked',
                    message: `Order ${orderId} by Affiliate ${affiliate.name} flagged: ${fraudReason}`,
                    priority: 'high'
                }]);
            }

            logger.info('Commission created (Advanced Logic)', {
                orderId,
                userId: payment.user_id,
                amount: finalCommission,
                tierMultiplier: multiplier
            });
        }
    }

    logger.info('Payment capture processed successfully', { orderId, captureId });
}

/**
 * Handle payment capture denial
 */
async function handlePaymentCaptureDenied(resource) {
    const captureId = resource.id;
    const orderId = resource.supplementary_data?.related_ids?.order_id;

    logger.warn('Payment capture denied', { orderId, captureId });

    // Update payment status to failed
    if (orderId) {
        const { error: updateError } = await db
            .from('payments')
            .update({ status: 'failed' })
            .eq('order_id', orderId);

        if (updateError) {
            logger.error('Failed to update payment status to failed', {
                error: updateError.message,
                orderId
            });
        }
    }
}

/**
 * Handle payment refund
 */
async function handlePaymentCaptureRefunded(resource) {
    const captureId = resource.id;
    const orderId = resource.supplementary_data?.related_ids?.order_id;
    const refundAmount = parseFloat(resource.amount?.value);

    logger.info('Payment refund processed', { orderId, captureId, refundAmount });

    // Update payment status and create refund record if needed
    if (orderId) {
        const { error: updateError } = await db
            .from('payments')
            .update({ status: 'refunded' })
            .eq('order_id', orderId);

        if (updateError) {
            logger.error('Failed to update payment status to refunded', {
                error: updateError.message,
                orderId
            });
        }

        // TODO: Implement refund commission reversal logic if needed
    }
}

/**
 * Handle order approval
 */
async function handleOrderApproved(resource) {
    const orderId = resource.id;

    logger.info('Order approved', { orderId });

    // Update order status if needed
    // This is typically followed by a capture event
}

module.exports = router;
