-- Users Table (Affiliates and Admins)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
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

-- Add category to products if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category') THEN
        ALTER TABLE products ADD COLUMN category VARCHAR(50) DEFAULT 'General';
    END IF;
END $$;
