-- Users Table (Affiliates and Admins)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'affiliate', -- 'admin', 'affiliate'
    paypal_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tracking Links Table
CREATE TABLE IF NOT EXISTS tracking_links (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    slug VARCHAR(50) UNIQUE NOT NULL,
    original_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Traffic Logs (Clicks)
CREATE TABLE IF NOT EXISTS traffic_logs (
    click_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id INTEGER REFERENCES tracking_links(id),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversions (Sales/Leads)
CREATE TABLE IF NOT EXISTS conversions (
    id SERIAL PRIMARY KEY,
    click_id UUID REFERENCES traffic_logs(click_id),
    amount DECIMAL(10, 2),
    type VARCHAR(20) DEFAULT 'sale', -- 'sale', 'lead'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commissions
CREATE TABLE IF NOT EXISTS commissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount DECIMAL(10, 2) NOT NULL,
    source_conversion_id INTEGER REFERENCES conversions(id),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid'
    is_recurring BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments Table (PayPal transactions)
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    order_id VARCHAR(255) NOT NULL,
    payer_id VARCHAR(255) NOT NULL,
    payment_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Logs (User Activities)
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    activity_type VARCHAR(50) NOT NULL, -- 'login', 'registration', 'payment', 'coupon_submission'
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activities Table (User Activity Logging)
CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add category to products if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category') THEN
        ALTER TABLE products ADD COLUMN category VARCHAR(50) DEFAULT 'General';
    END IF;
END $$;

-- Advertising Campaigns Table
CREATE TABLE IF NOT EXISTS advertising_campaigns (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    campaign_name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(50) DEFAULT 'social_media', -- 'social_media', 'website', 'email'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'active', 'paused', 'rejected'
    budget DECIMAL(10, 2) DEFAULT 0,
    target_audience TEXT,
    social_media_links JSONB, -- Store social media account links
    website_urls JSONB, -- Store website URLs for advertising
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Advertising Applications Table
CREATE TABLE IF NOT EXISTS advertising_applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    application_type VARCHAR(50) NOT NULL, -- 'advertising', 'commerce', 'services'
    social_media_accounts JSONB,
    website_urls JSONB,
    paypal_email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Activity Logs Table (Detailed tracking)
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    activity_type VARCHAR(100) NOT NULL, -- 'login', 'logout', 'page_view', 'campaign_create', etc.
    details JSONB, -- Store detailed activity data
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Sessions Table (For uptime tracking)
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    session_token VARCHAR(255) UNIQUE,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- System Ads Table
CREATE TABLE IF NOT EXISTS system_ads (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    image_url VARCHAR(500),
    target_url VARCHAR(500),
    ad_type VARCHAR(50) DEFAULT 'banner', -- 'banner', 'popup', 'sidebar'
    is_active BOOLEAN DEFAULT TRUE,
    display_priority INTEGER DEFAULT 1,
    target_audience VARCHAR(50) DEFAULT 'all', -- 'all', 'affiliate', 'admin'
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    revenue_generated DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ad Revenue Logs Table
CREATE TABLE IF NOT EXISTS ad_revenue_logs (
    id SERIAL PRIMARY KEY,
    ad_id INTEGER REFERENCES system_ads(id),
    user_id INTEGER REFERENCES users(id), -- User who viewed/clicked the ad
    revenue_type VARCHAR(50) DEFAULT 'impression', -- 'impression', 'click', 'conversion'
    amount DECIMAL(10, 2) NOT NULL,
    paypal_transaction_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin Notifications Table
CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    notification_type VARCHAR(50) NOT NULL, -- 'application', 'campaign', 'payment', 'system'
    reference_id INTEGER, -- ID of the related record
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email Logs Table
CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(255) NOT NULL,
    message TEXT,
    email_type VARCHAR(50) DEFAULT 'notification', -- 'notification', 'approval', 'rejection', 'payment'
    status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'pending'
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns to existing tables
DO $$
BEGIN
    -- Add new columns to users table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login') THEN
        ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='total_uptime') THEN
        ALTER TABLE users ADD COLUMN total_uptime INTEGER DEFAULT 0; -- in minutes
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='advertising_status') THEN
        ALTER TABLE users ADD COLUMN advertising_status VARCHAR(20) DEFAULT 'inactive'; -- 'inactive', 'pending', 'active'
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='commission_balance') THEN
        ALTER TABLE users ADD COLUMN commission_balance DECIMAL(10, 2) DEFAULT 0;
    END IF;

    -- Add new columns to payments table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='commission_amount') THEN
        ALTER TABLE payments ADD COLUMN commission_amount DECIMAL(10, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='platform_fee') THEN
        ALTER TABLE payments ADD COLUMN platform_fee DECIMAL(10, 2) DEFAULT 0;
    END IF;

    -- Add created_at to commissions table if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commissions' AND column_name='created_at') THEN
        ALTER TABLE commissions ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- Add updated_at to various tables
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='advertising_applications' AND column_name='updated_at') THEN
        ALTER TABLE advertising_applications ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='advertising_campaigns' AND column_name='updated_at') THEN
        ALTER TABLE advertising_campaigns ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
