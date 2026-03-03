const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../dbConfig');

// Register
router.post('/register', async (req, res) => {
    const { username, email, password, role, paypal_email } = req.body;

    // Basic validation
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Please provide username, email, and password.' });
    }

    try {
        // Check if user exists
        const { data: userCheck, error: checkError } = await db
            .from('users')
            .select('*')
            .or(`email.eq.${email},name.eq.${username}`);

        if (checkError) throw checkError;

        if (userCheck.length > 0) {
            return res.status(400).json({ error: 'User already exists.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role === 'admin' ? 'admin' : 'affiliate'; // Simple safeguard

        const { data: newUser, error: insertError } = await db
            .from('users')
            .insert([
                { name: username, email, password: hashedPassword, role: userRole, paypal_email }
            ])
            .select('id, name, role');

        if (insertError) throw insertError;

        const user = newUser[0];
        const token = jwt.sign({ id: user.id, role: user.role, username: user.name }, process.env.JWT_SECRET, { expiresIn: '1d' });

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
        const { data: userResult, error: fetchError } = await db
            .from('users')
            .select('*')
            .eq('email', email);

        if (fetchError) throw fetchError;

        // Auto-initialize Super Admin if it matches the requested email
        if (userResult.length === 0 && email === 'tsumamngindodenis@gmail.com') {
            const hashedPassword = await bcrypt.hash('Dennis123', 10);
            await db.from('users').insert([
                { name: 'SuperAdmin', email: 'tsumamngindodenis@gmail.com', password: hashedPassword, role: 'admin', paypal_email: 'denisbamboo@yahoo.com' }
            ]);
            return res.status(200).json({ message: 'Super Admin initialized. Please login again.' });
        }

        if (userResult.length === 0) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        const user = userResult[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        const token = jwt.sign({ id: user.id, role: user.role, username: user.name }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.cookie('token', token, { httpOnly: true, maxAge: 86400000 }); // 1 day
        res.json({ message: 'Login successful.', token, role: user.role, id: user.id, username: user.name });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

module.exports = router;
