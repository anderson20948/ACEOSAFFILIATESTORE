const { Client } = require('pg');
require('dotenv').config();

console.log("Config:", {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'postgres',
    port: process.env.DB_PORT,
    passLength: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0
});

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'postgres',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const targetDb = process.env.DB_DATABASE;

async function setup() {
    try {
        await client.connect();
        console.log("Connected to postgres database.");

        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname='${targetDb}'`);
        if (res.rowCount === 0) {
            console.log(`Creating database ${targetDb}...`);
            await client.query(`CREATE DATABASE ${targetDb}`);
        } else {
            console.log(`Database ${targetDb} already exists.`);
        }
        await client.end();

        const targetClient = new Client({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: targetDb,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
        });
        await targetClient.connect();
        console.log(`Connected to ${targetDb} database.`);

        const createTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            name VARCHAR(200) NOT NULL,
            email VARCHAR(200) NOT NULL,
            password VARCHAR(200) NOT NULL,
            role VARCHAR(50) DEFAULT 'affiliate',
            paypal_email VARCHAR(255),
            last_login TIMESTAMP,
            total_uptime INTEGER DEFAULT 0,
            advertising_status VARCHAR(20) DEFAULT 'inactive',
            commission_balance DECIMAL(10, 2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (email)
        );

        CREATE TABLE IF NOT EXISTS activities (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS products (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            title VARCHAR(255) NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            description TEXT,
            category VARCHAR(100) DEFAULT 'General',
            status VARCHAR(50) DEFAULT 'pending',
            user_id BIGINT,
            image_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS commissions (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            user_id BIGINT,
            amount DECIMAL(10, 2) NOT NULL,
            source_conversion_id BIGINT,
            status VARCHAR(20) DEFAULT 'pending',
            is_recurring BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS payments (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            order_id VARCHAR(100),
            user_id BIGINT,
            username VARCHAR(200),
            product_title VARCHAR(255),
            amount DECIMAL(10, 2),
            commission_amount DECIMAL(10, 2) DEFAULT 0,
            platform_fee DECIMAL(10, 2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS advertising_campaigns (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            user_id BIGINT,
            campaign_name VARCHAR(255) NOT NULL,
            campaign_type VARCHAR(50) DEFAULT 'social_media',
            status VARCHAR(20) DEFAULT 'pending',
            budget DECIMAL(10, 2) DEFAULT 0,
            target_audience TEXT,
            social_media_links JSONB,
            website_urls JSONB,
            impressions INTEGER DEFAULT 0,
            clicks INTEGER DEFAULT 0,
            revenue_generated DECIMAL(10, 2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS advertising_applications (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            user_id BIGINT,
            application_type VARCHAR(50) NOT NULL,
            social_media_accounts JSONB,
            website_urls JSONB,
            paypal_email VARCHAR(255),
            status VARCHAR(20) DEFAULT 'pending',
            admin_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_activity_logs (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            user_id BIGINT,
            activity_type VARCHAR(100) NOT NULL,
            details JSONB,
            ip_address VARCHAR(45),
            user_agent TEXT,
            session_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_sessions (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            user_id BIGINT,
            session_token VARCHAR(255) UNIQUE,
            login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            logout_time TIMESTAMP,
            ip_address VARCHAR(45),
            user_agent TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS traffic_logs (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            user_id BIGINT,
            page_url VARCHAR(500),
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS traffic_logs (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            user_id BIGINT,
            page_url VARCHAR(500),
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS system_ads (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            image_url VARCHAR(500),
            target_url VARCHAR(500),
            ad_type VARCHAR(50) DEFAULT 'banner',
            is_active BOOLEAN DEFAULT TRUE,
            display_priority INTEGER DEFAULT 1,
            target_audience VARCHAR(50) DEFAULT 'all',
            impressions INTEGER DEFAULT 0,
            clicks INTEGER DEFAULT 0,
            revenue_generated DECIMAL(10, 2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ad_revenue_logs (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            ad_id BIGINT,
            user_id BIGINT,
            revenue_type VARCHAR(50) DEFAULT 'impression',
            amount DECIMAL(10, 2) NOT NULL,
            paypal_transaction_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS admin_notifications (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            notification_type VARCHAR(50) NOT NULL,
            reference_id BIGINT,
            title VARCHAR(255) NOT NULL,
            message TEXT,
            is_read BOOLEAN DEFAULT FALSE,
            priority VARCHAR(20) DEFAULT 'normal',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS email_logs (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            recipient_email VARCHAR(255) NOT NULL,
            recipient_name VARCHAR(255),
            subject VARCHAR(255) NOT NULL,
            message TEXT,
            email_type VARCHAR(50) DEFAULT 'notification',
            status VARCHAR(20) DEFAULT 'sent',
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS system_settings (
            id BIGSERIAL PRIMARY KEY NOT NULL,
            setting_key VARCHAR(100) UNIQUE NOT NULL,
            setting_value TEXT,
            setting_type VARCHAR(50) DEFAULT 'string',
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        `;
        await targetClient.query(createTableQuery);

        // Ensure all required columns exist and fix table structures
        await targetClient.query(`
            DO $$
            BEGIN
                -- Users table columns (migration for existing databases)
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='paypal_email') THEN
                    ALTER TABLE users ADD COLUMN paypal_email VARCHAR(255);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login') THEN
                    ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='total_uptime') THEN
                    ALTER TABLE users ADD COLUMN total_uptime INTEGER DEFAULT 0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='advertising_status') THEN
                    ALTER TABLE users ADD COLUMN advertising_status VARCHAR(20) DEFAULT 'inactive';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='commission_balance') THEN
                    ALTER TABLE users ADD COLUMN commission_balance DECIMAL(10, 2) DEFAULT 0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='created_at') THEN
                    ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;

                -- Products table columns
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category') THEN
                    ALTER TABLE products ADD COLUMN category VARCHAR(100) DEFAULT 'General';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='image_url') THEN
                    ALTER TABLE products ADD COLUMN image_url TEXT;
                END IF;

                -- Payments table columns
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='commission_amount') THEN
                    ALTER TABLE payments ADD COLUMN commission_amount DECIMAL(10, 2) DEFAULT 0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='platform_fee') THEN
                    ALTER TABLE payments ADD COLUMN platform_fee DECIMAL(10, 2) DEFAULT 0;
                END IF;

                -- Commissions table columns
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commissions' AND column_name='created_at') THEN
                    ALTER TABLE commissions ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;

                -- User sessions table columns
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_sessions' AND column_name='created_at') THEN
                    ALTER TABLE user_sessions ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;

                -- Email logs table columns
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_logs' AND column_name='created_at') THEN
                    ALTER TABLE email_logs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;

                -- System settings table columns
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_settings' AND column_name='created_at') THEN
                    ALTER TABLE system_settings ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;

                -- Advertising campaigns table columns
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='advertising_campaigns' AND column_name='impressions') THEN
                    ALTER TABLE advertising_campaigns ADD COLUMN impressions INTEGER DEFAULT 0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='advertising_campaigns' AND column_name='clicks') THEN
                    ALTER TABLE advertising_campaigns ADD COLUMN clicks INTEGER DEFAULT 0;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='advertising_campaigns' AND column_name='revenue_generated') THEN
                    ALTER TABLE advertising_campaigns ADD COLUMN revenue_generated DECIMAL(10, 2) DEFAULT 0;
                END IF;

                -- Fix activities table structure
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='user_id') THEN
                    -- Drop and recreate activities table with correct structure
                    DROP TABLE activities;
                    CREATE TABLE activities (
                        id BIGSERIAL PRIMARY KEY NOT NULL,
                        message TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                END IF;
            END $$;
        `);

        console.log("Database schema updated successfully.");
        await targetClient.end();
        process.exit(0);
    } catch (err) {
        console.error("Error during setup:", err);
        process.exit(1);
    }
}

setup();
