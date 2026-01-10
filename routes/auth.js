const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

// Register
router.post('/register', async (req, res) => {
    const { username, email, password, role, paypal_email } = req.body;

    // Basic validation
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Please provide username, email, and password.' });
    }

    try {
        // Check if user exists
        const userCheck = await db.query('SELECT * FROM users WHERE email = $1 OR username = $2', [email, username]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role === 'admin' ? 'admin' : 'affiliate'; // Simple safeguard

        const newUser = await db.query(
            'INSERT INTO users (username, email, password_hash, role, paypal_email) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role',
            [username, email, hashedPassword, userRole, paypal_email]
        );

        const user = newUser.rows[0];
        const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.cookie('token', token, { httpOnly: true, maxAge: 86400000 }); // 1 day
        res.status(201).json({ message: 'User created successfully.', token, role: user.role, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        // Auto-initialize Super Admin if it matches the requested email
        if (userResult.rows.length === 0 && email === 'tsumamngindodenis@gmail.com') {
            const hashedPassword = await bcrypt.hash('Dennis123', 10);
            await db.query(
                'INSERT INTO users (username, email, password_hash, role, paypal_email) VALUES ($1, $2, $3, $4, $5)',
                ['SuperAdmin', 'tsumamngindodenis@gmail.com', hashedPassword, 'admin', 'denisbamboo@yahoo.com']
            );
            return res.status(200).json({ message: 'Super Admin initialized. Please login again.' });
        }

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.cookie('token', token, { httpOnly: true, maxAge: 86400000 }); // 1 day
        res.json({ message: 'Login successful.', token, role: user.role, id: user.id, username: user.username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

module.exports = router;
