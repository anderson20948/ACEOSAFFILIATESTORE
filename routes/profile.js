const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { db } = require('../dbConfig');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

// EnsureAuthenticated Middleware
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'aceos-secret-key');
        req.user = decoded;
        next();
    } catch (e) {
        res.status(401).json({ success: false, message: 'Session expired' });
    }
};

// Configure Multer for Profile Pictures (using Memory Storage for Vercel compatibility)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images (jpeg, jpg, png, gif) are allowed'));
    }
});

// POST /upload-avatar
router.post('/upload-avatar', ensureAuthenticated, upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    try {
        const file = req.file;
        const fileExt = path.extname(file.originalname).toLowerCase();
        const fileName = `profile-${req.user.id}-${Date.now()}${fileExt}`;
        const filePath = `avatars/${fileName}`;

        // 1. Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await db.storage
            .from('profiles')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (uploadError) {
            logger.error('Supabase Storage Upload Error:', uploadError);
            throw uploadError;
        }

        // 2. Get Public URL
        const { data: { publicUrl } } = db.storage
            .from('profiles')
            .getPublicUrl(filePath);
        
        // 3. Update user's profile picture URL in database
        const { error: dbError } = await db
            .from('users')
            .update({ profile_picture_url: publicUrl })
            .eq('id', req.user.id);

        if (dbError) throw dbError;

        res.json({ 
            success: true, 
            message: 'Profile picture updated successfully',
            imageUrl: publicUrl
        });
    } catch (err) {
        logger.error('Error updating profile picture:', { error: err.message });
        res.status(500).json({ success: false, message: 'Internal server error. Please ensure Supabase storage is configured.' });
    }
});

module.exports = router;
