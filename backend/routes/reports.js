const express = require('express');
const { wrapRouter } = require('../middleware/asyncHandler');
const router = wrapRouter(express.Router());
const { db } = require('../dbConfig');
const { ensureApiAuthenticated } = require('../middleware/auth');

/**
 * Performance Reporting & Analytics
 * Feature 1: Reliable tracking & reports
 */

router.get('/performance', ensureApiAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const { days = 7 } = req.query;
    
    try {
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        // 1. Get clicks grouped by day
        const { data: clicks, error: clickError } = await db
            .from('traffic_logs')
            .select('created_at')
            .eq('user_id', userId)
            .gt('created_at', startDate);

        if (clickError) throw clickError;

        // 2. Get conversions grouped by day
        const { data: conversions, error: convError } = await db
            .from('commissions')
            .select('created_at, amount')
            .eq('user_id', userId)
            .gt('created_at', startDate);

        if (convError) throw convError;

        // Aggregate data
        const report = {};
        
        // Initialize days
        for (let i = 0; i < days; i++) {
            const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            report[date] = { clicks: 0, conversions: 0, earnings: 0 };
        }

        clicks.forEach(c => {
            const date = c.created_at.split('T')[0];
            if (report[date]) report[date].clicks++;
        });

        conversions.forEach(c => {
            const date = c.created_at.split('T')[0];
            if (report[date]) {
                report[date].conversions++;
                report[date].earnings += parseFloat(c.amount);
            }
        });

        res.json({ success: true, report });

    } catch (err) {
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

module.exports = router;
