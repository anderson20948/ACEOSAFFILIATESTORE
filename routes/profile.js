const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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

// Configure Multer for Profile Pictures
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../public/uploads/profiles');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
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
        const profileUrl = `/uploads/profiles/${req.file.filename}`;
        
        // Update user's profile picture URL in database
        const { error } = await db
            .from('users')
            .update({ profile_picture_url: profileUrl })
            .eq('id', req.user.id);

        if (error) throw error;

        res.json({ 
            success: true, 
            message: 'Profile picture updated successfully',
            imageUrl: profileUrl
        });
    } catch (err) {
        logger.error('Error updating profile picture:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;
