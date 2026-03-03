const express = require('express');
const router = express.Router();
const { db } = require('../dbConfig');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Passport authentication check
const verifyAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
};

// Upload a product
router.post('/upload', verifyAuth, upload.single('image'), async (req, res) => {
    const { title, description, price } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!title || !price) {
        return res.status(400).json({ error: 'Title and price are required.' });
    }

    try {
        const { data: newProduct, error } = await db
            .from("products")
            .insert([
                { owner_id: req.user.id, title, description, price, image_url: imageUrl, status: 'pending' }
            ])
            .select("*");

        if (error) throw error;
        res.status(201).json({ message: 'Product uploaded and pending approval.', product: newProduct[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error uploading product.' });
    }
});

// Get approved products for affiliates
router.get('/available', async (req, res) => {
    try {
        const { data: products, error } = await db
            .from("products")
            .select("*")
            .eq("status", "approved")
            .order("created_at", { ascending: false });

        if (error) throw error;
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching products.' });
    }
});

// Submit Coupon (Affiliate)
router.post('/submit', verifyAuth, async (req, res) => {
    const { title, description, price, category } = req.body;
    const userId = req.user.id;
    const ip = req.ip || req.connection.remoteAddress;

    if (!title || !price) {
        return res.status(400).json({ error: 'Title and Price are required' });
    }

    try {
        const { data: result, error: insertError } = await db
            .from("products")
            .insert([
                { title, description, price, category: category || 'General', owner_id: userId }
            ])
            .select("*");

        if (insertError) throw insertError;

        // Log the activity
        const { error: logError } = await db
            .from("system_logs")
            .insert([
                { user_id: userId, activity_type: 'coupon_submission', details: `Submitted coupon: ${title}`, ip_address: ip }
            ]);

        if (logError) throw logError;

        res.status(201).json({ message: 'Coupon submitted successfully for approval', product: result[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error submitting coupon' });
    }
});

module.exports = router;
