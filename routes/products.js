const express = require('express');
const router = express.Router();
const { pool: db } = require('../dbConfig');
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
        const newProduct = await db.query(
            'INSERT INTO products (owner_id, title, description, price, image_url, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [req.user.id, title, description, price, imageUrl, 'pending']
        );
        res.status(201).json({ message: 'Product uploaded and pending approval.', product: newProduct.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error uploading product.' });
    }
});

// Get approved products for affiliates
router.get('/available', async (req, res) => {
    try {
        const products = await db.query('SELECT * FROM products WHERE status = $1 ORDER BY created_at DESC', ['approved']);
        res.json(products.rows);
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
        const result = await db.query(
            'INSERT INTO products (title, description, price, category, owner_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [title, description, price, category || 'General', userId]
        );

        // Log the activity
        await db.query(
            'INSERT INTO system_logs (user_id, activity_type, details, ip_address) VALUES ($1, $2, $3, $4)',
            [userId, 'coupon_submission', `Submitted coupon: ${title}`, ip]
        );

        res.status(201).json({ message: 'Coupon submitted successfully for approval', product: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error submitting coupon' });
    }
});

module.exports = router;
