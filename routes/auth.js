const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../dbConfig');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'aceos-secret-key';

// Helper to check if user is admin
function isAdmin(user) {
    return user && user.role === 'admin';
}

// Register
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Please provide name, email, and password' });
    }

    try {
        // Check if user exists
        const { data: userCheck, error: checkError } = await db
            .from('users')
            .select('*')
            .eq('email', email);

        if (checkError) throw checkError;

        if (userCheck.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const { data: insertResults, error: insertError } = await db
            .from('users')
            .insert([
                { name: username, email, password: hashedPassword, role: "affiliate" }
            ])
            .select('id, name, email, role');

        if (insertError) throw insertError;
        const newUser = insertResults[0];

        // Generate JWT
        const token = jwt.sign(
            { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Set cookie
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 });

        // Log activity
        await db.from('activities').insert([
            { message: `New user registered: ${username} (${email})`, created_at: new Date() }
        ]);

        // Send welcome email (non-blocking)
        emailService.sendWelcomeEmail(email, username).catch(e => logger.error('Welcome email failed', e));

        res.status(201).json({
            message: "Registration successful! Welcome to Aceos.",
            token: token,
            role: newUser.role,
            id: newUser.id,
            username: newUser.name,
            autoLoggedIn: true
        });
    } catch (err) {
        logger.error('Registration error:', err);
        res.status(500).json({ error: 'A server error occurred during registration.' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email and password.' });
    }

    try {
        // Create a query timeout so slow DB connections don't hang requests
        const queryTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database query timed out')), 10000)
        );

        const dbQuery = db.from('users').select('*').eq('email', email);

        const { data: users, error: fetchError } = await Promise.race([dbQuery, queryTimeout]);

        if (fetchError) throw fetchError;

        if (!users || users.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const userRole = user.role || 'affiliate';

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: userRole, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });

        res.json({
            message: 'Login successful.',
            token: token,
            role: userRole,
            id: user.id,
            username: user.name
        });
    } catch (err) {
        logger.error('Login error:', { error: err.message });
        if (err.message === 'Database query timed out') {
            return res.status(503).json({ error: 'The service is temporarily unavailable. Please try again.' });
        }
        res.status(500).json({ error: 'Server error during login. Please try again.' });
    }
});

// Forgot Password - Step 1: Request Code
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const { data: users, error: userError } = await db.from('users').select('id, name').eq('email', email);
        if (userError) throw userError;

        if (users.length === 0) {
            return res.json({ success: true, message: 'If your email is registered, you will receive a recovery code shortly.' });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await db.from('password_resets').delete().eq('email', email);
        await db.from('password_resets').insert([{ email, code, expires_at: expiresAt }]);

        await emailService.sendPasswordResetCode(email, code);
        res.json({ success: true, message: 'Recovery code sent successfully.' });
    } catch (err) {
        logger.error('Forgot password error:', err);
        res.status(500).json({ success: false, message: 'Error processing request.' });
    }
});

// Forgot Password - Step 2: Verify Code
router.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;
    try {
        const { data: resets, error: resetError } = await db
            .from('password_resets')
            .select('*')
            .eq('email', email)
            .eq('code', code)
            .gt('expires_at', new Date().toISOString());

        if (resetError) throw resetError;
        if (resets.length === 0) return res.status(400).json({ success: false, message: 'Invalid or expired code.' });

        await db.from('password_resets').update({ verified: true }).eq('id', resets[0].id);
        res.json({ success: true, message: 'Code verified successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Verification failed.' });
    }
});

// Forgot Password - Step 3: Reset Password
router.post('/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    try {
        const { data: resets, error: resetError } = await db
            .from('password_resets')
            .select('*')
            .eq('email', email)
            .eq('code', code)
            .eq('verified', true)
            .gt('expires_at', new Date().toISOString());

        if (resetError || resets.length === 0) return res.status(400).json({ success: false, message: 'Unauthorized reset.' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.from('users').update({ password: hashedPassword }).eq('email', email);
        await db.from('password_resets').delete().eq('email', email);

        res.json({ success: true, message: 'Password reset successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Reset failed.' });
    }
});

module.exports = router;
