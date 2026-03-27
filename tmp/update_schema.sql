-- SQL Migration for Advanced Dashboard Features

-- 1. Update system_ads to support user-submitted ads
ALTER TABLE system_ads ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- 2. Update users to support profile pictures
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- 3. (Optional) Create a default storage folder for profile pictures if using local storage
-- No SQL needed for local folders, handled via Node.js
