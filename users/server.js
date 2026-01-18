const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve existing site static files
const staticPath = path.resolve(__dirname);
console.log('Serving static files from:', staticPath);
app.use(express.static(staticPath));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Tracking Middleware
app.use(async (req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
        const userId = req.cookies.token ? require('jsonwebtoken').decode(req.cookies.token)?.id : null;
        const ip = req.ip || req.connection.remoteAddress;
        try {
            await db.query(
                'INSERT INTO system_logs (user_id, activity_type, details, ip_address) VALUES ($1, $2, $3, $4)',
                [userId, 'page_visit', `Visited ${req.path}`, ip]
            );
        } catch (err) {
            console.error('Tracking error:', err);
        }
    }
    next();
});

// Routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const affiliateRoutes = require('./routes/affiliate');
const trackingRoutes = require('./routes/tracking');
const adminRoutes = require('./routes/admin');
const paypalRoutes = require('./routes/paypal');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/affiliate', affiliateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/paypal', paypalRoutes);
app.use('/t', trackingRoutes);

// Serve HTML pages
app.get('/login', (req, res) => res.sendFile(path.join(staticPath, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(staticPath, 'register.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(staticPath, 'dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(staticPath, 'admin.html')));

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(staticPath, 'home.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on ${process.env.BASE_URL}`);
});
