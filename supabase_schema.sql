-- ACEOS Supabase Schema
-- Run this in your Supabase SQL Editor

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'affiliate',
    paypal_email TEXT,
    commission_balance DECIMAL(15,2) DEFAULT 0,
    advertising_status TEXT DEFAULT 'inactive',
    last_login TIMESTAMP WITH TIME ZONE,
    total_uptime INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    price DECIMAL(15,2) NOT NULL,
    category TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'pending',
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    product_id UUID REFERENCES products(id),
    amount DECIMAL(15,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    transaction_id TEXT, -- Legacy/Generic ID
    order_id TEXT UNIQUE, -- PayPal/Google Pay Order ID
    payer_id TEXT, -- PayPal Payer ID
    payment_id TEXT, -- PayPal Capture/Payment ID
    payment_method TEXT DEFAULT 'paypal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Commissions Table
CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    order_id TEXT, -- Using TEXT to support various payment provider order IDs
    amount DECIMAL(15,2) NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, paid
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activities/System Logs Table
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    message TEXT NOT NULL,
    activity_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Logs (more detailed)
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    activity_type TEXT,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Traffic Logs
CREATE TABLE IF NOT EXISTS traffic_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    product_id UUID REFERENCES products(id),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Advertising Applications
CREATE TABLE IF NOT EXISTS advertising_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    application_type TEXT, -- social_media, website, both
    social_media_accounts JSONB,
    website_urls JSONB,
    paypal_email TEXT,
    status TEXT DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Advertising Campaigns
CREATE TABLE IF NOT EXISTS advertising_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    campaign_name TEXT,
    campaign_type TEXT,
    status TEXT DEFAULT 'active',
    impressions INTEGER DEFAULT 0,
    revenue_generated DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Ads
CREATE TABLE IF NOT EXISTS system_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT,
    image_url TEXT,
    target_url TEXT,
    is_active BOOLEAN DEFAULT true,
    display_priority INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Logs
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT NOT NULL,
    subject TEXT,
    email_type TEXT,
    status TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Activity Logs (detailed)
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    activity_type TEXT,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    logout_time TIMESTAMP WITH TIME ZONE,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin Notifications
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_type TEXT,
    reference_id UUID,
    title TEXT,
    message TEXT,
    priority TEXT DEFAULT 'normal',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Password Resets Table
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
-- Tracking Links (for Affiliate URLs)
CREATE TABLE IF NOT EXISTS tracking_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    product_id UUID REFERENCES products(id),
    slug TEXT UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tracking_links_slug ON tracking_links(slug);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertising_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertising_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_logs ENABLE ROW LEVEL SECURITY;


-- Basic Policies for Users (Can only read/edit their own profile)
CREATE POLICY "Users can view their own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Basic Policies for Products
-- Public can view approved products
CREATE POLICY "Public can view approved products" ON products FOR SELECT USING (status = 'approved');
-- Owners can manage their own products
CREATE POLICY "Owners can manage their own products" ON products FOR ALL USING (auth.uid() = user_id);

-- Basic Policies for Payments
CREATE POLICY "Users can view their own payments" ON payments FOR SELECT USING (auth.uid() = user_id);

-- Basic Policies for Commissions
CREATE POLICY "Users can view their own commissions" ON commissions FOR SELECT USING (auth.uid() = user_id);

-- Basic Policies for Activities
CREATE POLICY "Users can view their own activities" ON activities FOR SELECT USING (auth.uid() = user_id);

-- Basic Policies for Advertising Applications
CREATE POLICY "Users can manage their own advertising applications" ON advertising_applications FOR ALL USING (auth.uid() = user_id);

-- Basic Policies for Advertising Campaigns
CREATE POLICY "Users can manage their own advertising campaigns" ON advertising_campaigns FOR ALL USING (auth.uid() = user_id);

-- Basic Policies for Tracking Links
CREATE POLICY "Users can manage their own tracking links" ON tracking_links FOR ALL USING (auth.uid() = user_id);

-- Admin can see everything (Example for a specific admin role or a bypass if using service key)
-- Note: Service Role key bypasses RLS automatically.
-- For within-app admin checks, policies can be more complex.
-- Tables that typically remain RLS disabled or have very broad policies for system/admin access:
-- system_logs, traffic_logs, email_logs, user_activity_logs, user_sessions, admin_notifications, password_resets, system_ads
-- For now, we'll keep them enabled and assume admin policies will be added later or service role key is used.

-- RPC Functions for atomic increments
CREATE OR REPLACE FUNCTION increment_ad_impressions(ad_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE system_ads
  SET impressions = impressions + 1,
      updated_at = NOW()
  WHERE id = ad_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_ad_clicks(ad_id_param UUID, amount_param DECIMAL)
RETURNS void AS $$
BEGIN
  UPDATE system_ads
  SET clicks = clicks + 1,
      revenue_generated = revenue_generated + amount_param,
      updated_at = NOW()
  WHERE id = ad_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_user_balance(user_id_param UUID, amount_param DECIMAL)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET commission_balance = commission_balance + amount_param
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;
