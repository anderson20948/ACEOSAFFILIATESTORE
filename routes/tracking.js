const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/:slug', async (req, res) => {
    const { slug } = req.params;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    try {
        // Find the link
        const linkResult = await db.query('SELECT * FROM tracking_links WHERE slug = $1', [slug]);

        if (linkResult.rows.length === 0) {
            return res.status(404).send('Link not found');
        }

        const link = linkResult.rows[0];

        // Log the click
        const logResult = await db.query(
            'INSERT INTO traffic_logs (link_id, ip_address, user_agent) VALUES ($1, $2, $3) RETURNING click_id',
            [link.id, ip, userAgent]
        );
        const clickId = logResult.rows[0].click_id;

        // Set Cookie (30 days)
        res.cookie('affiliate_click_id', clickId, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });

        // Redirect
        res.redirect(link.original_url);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
