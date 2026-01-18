const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const USERS = [
    { name: 'John Doe', email: 'john@example.com', role: 'affiliate', paypal: 'john.paypal@example.com' },
    { name: 'Jane Smith', email: 'jane@example.com', role: 'user', paypal: 'jane.paypal@example.com' },
    { name: 'Mike Johnson', email: 'mike@example.com', role: 'affiliate', paypal: 'mike.paypal@example.com' },
    { name: 'Sarah Williams', email: 'sarah@example.com', role: 'user', paypal: 'sarah.paypal@example.com' },
    { name: 'David Brown', email: 'david@example.com', role: 'affiliate', paypal: 'david.paypal@example.com' },
    { name: 'Emily Davis', email: 'emily@example.com', role: 'affiliate', paypal: 'emily.paypal@example.com' },
    { name: 'Chris Wilson', email: 'chris@example.com', role: 'user', paypal: 'chris.paypal@example.com' },
    { name: 'Jessica Taylor', email: 'jessica@example.com', role: 'affiliate', paypal: 'jessica.paypal@example.com' },
    { name: 'Matthew Anderson', email: 'matthew@example.com', role: 'user', paypal: 'matthew.paypal@example.com' },
    { name: 'Ashley Thomas', email: 'ashley@example.com', role: 'affiliate', paypal: 'ashley.paypal@example.com' }
];

const PRODUCTS = [
    { title: 'Premium Widget', price: 29.99, category: 'Electronics', status: 'approved' },
    { title: 'Super Gadget', price: 49.99, category: 'Electronics', status: 'pending' },
    { title: 'Deluxe Tool', price: 19.99, category: 'Home & Garden', status: 'approved' },
    { title: 'Mega Pack', price: 99.99, category: 'Bundles', status: 'rejected' },
    { title: 'Fitness Tracker', price: 59.99, category: 'Health', status: 'pending' },
    { title: 'Smart Watch', price: 129.99, category: 'Electronics', status: 'approved' },
    { title: 'Wireless Earbuds', price: 39.99, category: 'Audio', status: 'pending' },
    { title: 'Gaming Mouse', price: 25.00, category: 'Gaming', status: 'approved' },
    { title: 'Mechanical Keyboard', price: 89.00, category: 'Gaming', status: 'approved' },
    { title: 'USB-C Hub', price: 35.00, category: 'Accessories', status: 'pending' }
];

const ADS = [
    { title: 'Summer Sale', type: 'banner', priority: 1, active: true },
    { title: 'Black Friday', type: 'popup', priority: 2, active: false },
    { title: 'New Arrivals', type: 'sidebar', priority: 1, active: true },
    { title: 'Clearance', type: 'banner', priority: 0, active: true }
];

async function seed() {
    try {
        await client.connect();
        console.log("Connected to database for seeding...");

        // 1. Seed Users
        console.log("Seeding Users...");
        const passwordHash = await bcrypt.hash('password123', 10);
        const userIds = [];

        for (const user of USERS) {
            const check = await client.query("SELECT id FROM users WHERE email = $1", [user.email]);
            let userId;

            if (check.rows.length === 0) {
                const res = await client.query(
                    `INSERT INTO users (name, email, password, role, paypal_email, commission_balance, created_at, last_login) 
                     VALUES ($1, $2, $3, $4, $5, $6, NOW() - (random() * interval '30 days'), NOW() - (random() * interval '5 days')) 
                     RETURNING id`,
                    [user.name, user.email, passwordHash, user.role, user.paypal, Math.floor(Math.random() * 500)]
                );
                userId = res.rows[0].id;
                console.log(`Created user: ${user.name}`);
            } else {
                userId = check.rows[0].id;
                console.log(`User exists: ${user.name}`);
            }
            userIds.push(userId);
        }

        // 2. Seed Products
        console.log("Seeding Products...");
        for (const product of PRODUCTS) {
            const randomUser = userIds[Math.floor(Math.random() * userIds.length)];
            await client.query(
                `INSERT INTO products (title, price, description, category, status, user_id, image_url, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - (random() * interval '60 days'))`,
                [product.title, product.price, `Description for ${product.title}`, product.category, product.status, randomUser, 'https://via.placeholder.com/150']
            );
        }

        // 3. Seed Activities
        console.log("Seeding Activities...");
        const activityMessages = [
            "User logged in", "Product updated", "New registration", "Payment processed",
            "Settings changed", "Campaign started", "Commission paid", "Profile updated"
        ];

        for (let i = 0; i < 50; i++) {
            const msg = activityMessages[Math.floor(Math.random() * activityMessages.length)];
            const randomTime = Math.floor(Math.random() * 10000);
            await client.query(
                "INSERT INTO activities (message, created_at) VALUES ($1, NOW() - ($2 || ' minutes')::INTERVAL)",
                [`${msg} - Random Action #${i}`, randomTime]
            );
        }

        // 4. Seed User Activity Logs
        console.log("Seeding User Activity Logs...");
        for (let i = 0; i < 50; i++) {
            const randomUser = userIds[Math.floor(Math.random() * userIds.length)];
            await client.query(
                `INSERT INTO user_activity_logs (user_id, activity_type, details, ip_address, user_agent, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW() - (random() * interval '7 days'))`,
                [
                    randomUser,
                    ['login', 'view_product', 'purchase', 'update_profile'][Math.floor(Math.random() * 4)],
                    JSON.stringify({ location: 'Dashboard', device: 'Desktop' }),
                    `192.168.1.${Math.floor(Math.random() * 255)}`,
                    'Mozilla/5.0 (X11; Linux x86_64)',
                ]
            );
        }

        // 5. Seed Payments
        console.log("Seeding Payments...");
        for (let i = 0; i < 30; i++) {
            const randomUser = userIds[Math.floor(Math.random() * userIds.length)];
            const amount = (Math.random() * 100 + 10).toFixed(2);
            await client.query(
                `INSERT INTO payments (order_id, user_id, username, product_title, amount, commission_amount, platform_fee, created_at)
                  VALUES ($1, $2, (SELECT name FROM users WHERE id = $2), $3, $4, $5, $6, NOW() - (random() * interval '30 days'))`,
                [`ORD-${1000 + i}`, randomUser, PRODUCTS[0].title, amount, (amount * 0.1).toFixed(2), (amount * 0.05).toFixed(2)]
            );
        }

        // 6. Seed Commissions
        console.log("Seeding Commissions...");
        for (let i = 0; i < 20; i++) {
            const randomUser = userIds[Math.floor(Math.random() * userIds.length)];
            const amount = (Math.random() * 50 + 5).toFixed(2);
            await client.query(
                `INSERT INTO commissions (user_id, amount, status, is_recurring, created_at)
                 VALUES ($1, $2, $3, $4, NOW() - (random() * interval '30 days'))`,
                [randomUser, amount, Math.random() > 0.5 ? 'paid' : 'pending', Math.random() > 0.8]
            );
        }

        // 7. Seed Advertising Applications
        console.log("Seeding Advertising Applications...");
        for (let i = 0; i < 10; i++) {
            const randomUser = userIds[Math.floor(Math.random() * userIds.length)];
            await client.query(
                `INSERT INTO advertising_applications (user_id, application_type, paypal_email, status, created_at)
                 VALUES ($1, $2, $3, $4, NOW() - (random() * interval '14 days'))`,
                [randomUser, 'Social Media Influencer', 'user@paypal.com', ['pending', 'approved', 'rejected'][Math.floor(Math.random() * 3)]]
            );
        }

        // 8. Seed Advertising Campaigns
        console.log("Seeding Advertising Campaigns...");
        for (let i = 0; i < 5; i++) {
            const randomUser = userIds[Math.floor(Math.random() * userIds.length)];
            await client.query(
                `INSERT INTO advertising_campaigns (user_id, campaign_name, status, budget, impressions, clicks, revenue_generated, created_at)
                 VALUES ($1, 'Summer Promo', 'active', 500.00, $2, $3, $4, NOW() - (random() * interval '10 days'))`,
                [
                    randomUser,
                    Math.floor(Math.random() * 10000),
                    Math.floor(Math.random() * 500),
                    (Math.random() * 200).toFixed(2)
                ]
            );
        }

        // 9. Seed System Ads
        console.log("Seeding System Ads...");
        for (const ad of ADS) {
            await client.query(
                `INSERT INTO system_ads (title, content, ad_type, is_active, display_priority, impressions, clicks, revenue_generated, created_at)
                 VALUES ($1, 'Ad Content Here', $2, $3, $4, $5, $6, $7, NOW())`,
                [
                    ad.title,
                    ad.type,
                    ad.active,
                    ad.priority,
                    Math.floor(Math.random() * 5000),
                    Math.floor(Math.random() * 500),
                    (Math.random() * 200).toFixed(2)
                ]
            );
        }

        // 10. Seed Traffic Logs
        console.log("Seeding Traffic Logs...");
        for (let i = 0; i < 100; i++) {
            const randomUser = Math.random() > 0.3 ? userIds[Math.floor(Math.random() * userIds.length)] : null;
            await client.query(
                `INSERT INTO traffic_logs (user_id, page_url, ip_address, user_agent, created_at)
                 VALUES ($1, $2, $3, $4, NOW() - (random() * interval '2 days'))`,
                [
                    randomUser,
                    ['/home', '/products', '/dashboard', '/register'][Math.floor(Math.random() * 4)],
                    `10.0.0.${Math.floor(Math.random() * 255)}`,
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                ]
            );
        }

        // 11. Seed Admin Notifications
        console.log("Seeding Admin Notifications...");
        const notifTypes = ['application', 'payment', 'system', 'alert'];
        for (let i = 0; i < 15; i++) {
            await client.query(
                `INSERT INTO admin_notifications (notification_type, title, message, is_read, priority, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW() - (random() * interval '3 days'))`,
                [
                    notifTypes[Math.floor(Math.random() * notifTypes.length)],
                    'System Update',
                    'Something happened in the system that needs attention.',
                    Math.random() > 0.7,
                    Math.random() > 0.9 ? 'critical' : 'normal'
                ]
            );
        }

        console.log("Seeding complete!");
        await client.end();
        process.exit(0);

    } catch (err) {
        console.error("Error seeding data:", err);
        process.exit(1);
    }
}

seed();
