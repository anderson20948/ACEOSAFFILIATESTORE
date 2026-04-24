const express = require('express');
const { wrapRouter } = require('../middleware/asyncHandler');
const router = wrapRouter(express.Router());
const { db } = require('../dbConfig');
const { verifyAdmin } = require('../middleware/auth');

/**
 * System Settings & Branding
 * Feature 2: Customization & Branding
 */

// Get all settings
router.get('/', async (req, res) => {
    try {
        const { data: settings, error } = await db.from('system_settings').select('*');
        if (error) throw error;

        // Convert array to object for easier consumption
        const settingsObj = {};
        settings.forEach(s => settingsObj[s.key] = s.value);

        res.json({ success: true, settings: settingsObj });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update settings (Admin only)
router.post('/update', verifyAdmin, async (req, res) => {
    const { updates } = req.body; // { brand_name: 'New Name', primary_color: '#ff0000' }
    
    try {
        for (const [key, value] of Object.entries(updates)) {
            await db.from('system_settings')
                .update({ value })
                .eq('key', key);
        }

        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

module.exports = router;
