const express = require('express');
const { wrapRouter } = require('../middleware/asyncHandler');
const router = wrapRouter(express.Router());
const { db } = require('../dbConfig');
const { ensureApiAuthenticated } = require('../middleware/auth');

/**
 * Coupon Management for Affiliates
 * Enables tracking on Instagram/Offline where links are restricted
 */

// Get my coupons
router.get('/my-coupons', ensureApiAuthenticated, async (req, res) => {
    try {
        const { data: coupons, error } = await db
            .from('coupons')
            .select('*')
            .eq('user_id', req.user.id);

        if (error) throw error;
        res.json({ success: true, coupons });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch coupons' });
    }
});

// Create new coupon
router.post('/create', ensureApiAuthenticated, async (req, res) => {
    const { code, discount_percent = 10 } = req.body;
    
    if (!code || code.length < 3) {
        return res.status(400).json({ error: 'Invalid coupon code' });
    }

    try {
        // Check if code exists
        const { data: existing } = await db.from('coupons').select('id').eq('code', code.toUpperCase()).single();
        if (existing) {
            return res.status(400).json({ error: 'Coupon code already exists' });
        }

        const { data: newCoupon, error } = await db.from('coupons').insert([{
            user_id: req.user.id,
            code: code.toUpperCase(),
            discount_percent,
            is_active: true
        }]);

        if (error) throw error;
        res.json({ success: true, coupon: newCoupon });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create coupon' });
    }
});

// Validate coupon (public)
router.get('/validate/:code', async (req, res) => {
    const { code } = req.params;
    try {
        const { data: coupon, error } = await db
            .from('coupons')
            .select('*, users(name)')
            .eq('code', code.toUpperCase())
            .eq('is_active', true)
            .single();

        if (error || !coupon) {
            return res.status(404).json({ valid: false, message: 'Invalid or inactive coupon' });
        }

        res.json({ 
            valid: true, 
            discount_percent: coupon.discount_percent,
            affiliate: coupon.users.name
        });
    } catch (err) {
        res.status(500).json({ error: 'Validation error' });
    }
});

module.exports = router;
