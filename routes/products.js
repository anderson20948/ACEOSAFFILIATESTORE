const express = require('express');
const router = express.Router();
const { db } = require('../dbConfig');
const logger = require('../utils/logger');
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
    const { title, description, price, category } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!title || !price || !category) {
        return res.status(400).json({ error: 'Title, price, and category are required.' });
    }

    try {
        const { data: newProduct, error } = await db
            .from("products")
            .insert([
                { 
                    user_id: req.user.id, 
                    title, 
                    description, 
                    price: parseFloat(price), 
                    category,
                    image_url: imageUrl, 
                    status: 'pending' 
                }
            ])
            .select("*");

        if (error) throw error;
        res.status(201).json({ message: 'Product uploaded successfully and is now pending approval.', product: newProduct[0] });
    } catch (err) {
        logger.error(err);
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
        logger.error(err);
        res.status(500).json({ error: 'Error fetching products.' });
    }
});

// Get unique categories for search
router.get('/categories', async (req, res) => {
    try {
        const { data, error } = await db
            .from("products")
            .select("category")
            .eq("status", "approved");

        if (error) throw error;

        const categories = [...new Set(data.map(item => item.category))].filter(Boolean);
        res.json(categories);
    } catch (err) {
        logger.error(err);
        res.status(500).json({ error: 'Error fetching categories' });
    }
});

// Universal Search: Products, Ads, and Pages
router.get('/search', async (req, res) => {
    const { q, category } = req.query;
    if (!q && (!category || category === '0')) {
        return res.json([]);
    }

    const searchTerm = q ? q.toLowerCase() : "";

    // 1. Static Pages Definition
    const staticPages = [
        { title: "Home", description: "Aceos Affiliate Store - Save More With Our Deals", url: "home.html", type: "page", keywords: "index, main, deals, coupons" },
        { title: "About Us", description: "Learn more about Aceos Affiliate Store and our mission", url: "about.html", type: "page", keywords: "team, mission, company" },
        { title: "Contact Us", description: "Get in touch with our support team for help", url: "contact.html", type: "page", keywords: "support, help, email, phone, sign in assistance" },
        { title: "Blog", description: "Latest news, updates, and affiliate marketing tips from Aceos", url: "blog.html", type: "page", keywords: "news, articles, tips" },
        { title: "Store", description: "Browse all available deals, coupons, and discounts", url: "store.html", type: "page", keywords: "deals, shop, browse, products" },
        { title: "Submit Coupon", description: "Share a deal or coupon with the community and earn rewards", url: "submit-coupon.html", type: "page", keywords: "share, post, affiliate, earn" },
        { title: "Category", description: "Explore deals by category including Electronics, Fashion, and more", url: "category.html", type: "page", keywords: "electronics, kitchen, health, fitness, beauty, sports, restaurant" },
        { title: "Login / Sign-in", description: "Sign in to your account to access your affiliate dashboard", url: "login.html", type: "page", keywords: "sign in, signin, login, access, account" },
        { title: "Register / Sign-up", description: "Join the Aceos affiliate network and start earning today", url: "register.html", type: "page", keywords: "sign up, signup, join, register, account" },
        { title: "Dashboard", description: "Manage your affiliate account, products, and advertising", url: "admin.html", type: "page", keywords: "admin, management, metrics, ads, products" },
        { title: "Electronics Deals", description: "Browse top electronics deals and electronic gadgets", url: "category.html?category=Electronics", type: "page", keywords: "phones, laptops, gadgets, electronics" },
        { title: "Forgot Password", description: "Recover or reset your account password", url: "forgot-password.html", type: "page", keywords: "recovery, reset, lost password" }
    ];

    try {
        // 2. Search Products
        let productQuery = db.from("products").select("*").eq("status", "approved");
        if (q) productQuery = productQuery.or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);
        if (category && category !== '0') productQuery = productQuery.eq("category", category);
        const { data: products } = await productQuery.limit(30);

        // 3. Search Ads
        let adsQuery = db.from("system_ads").select("*").eq("is_active", true);
        if (q) adsQuery = adsQuery.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
        const { data: ads } = await adsQuery.limit(10);

        // 4. Search Static Pages (Local match)
        const matchedPages = staticPages.filter(p =>
            p.title.toLowerCase().includes(searchTerm) ||
            p.description.toLowerCase().includes(searchTerm) ||
            (p.keywords && p.keywords.toLowerCase().includes(searchTerm))
        );

        // Format Results
        const results = [
            ...(products || []).map(p => ({ ...p, type: 'product' })),
            ...(ads || []).map(a => ({ ...a, type: 'ad' })),
            ...matchedPages
        ];

        // Sort by relevance (Exact match first, then starts with, then contains)
        results.sort((a, b) => {
            const aTitle = (a.title || "").toLowerCase();
            const bTitle = (b.title || "").toLowerCase();

            if (aTitle === searchTerm) return -1;
            if (bTitle === searchTerm) return 1;

            if (aTitle.startsWith(searchTerm) && !bTitle.startsWith(searchTerm)) return -1;
            if (bTitle.startsWith(searchTerm) && !aTitle.startsWith(searchTerm)) return 1;

            return 0;
        });

        res.json(results);
    } catch (err) {
        logger.error(err);
        res.status(500).json({ error: 'Error performing universal search' });
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
                { title, description, price, category: category || 'General', user_id: userId }
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
        logger.error(err);
        res.status(500).json({ error: 'Error submitting coupon' });
    }
});

module.exports = router;
