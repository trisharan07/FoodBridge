-- FoodBridge v2 migration
-- Run this after the initial schema.sql

-- 1. Admin role was already in the ENUM. Ensure it is.
-- ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. Verification fields for admin verification feature
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Volunteer live-tracking: store latest lat/lng per assignment
ALTER TABLE volunteer_assignments ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION;
ALTER TABLE volunteer_assignments ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION;
ALTER TABLE volunteer_assignments ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

-- 4. Delivery confirmation fields
ALTER TABLE pickups ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE pickups ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT;
ALTER TABLE pickups ADD COLUMN IF NOT EXISTS delivery_note TEXT;

-- 5. Food listing: ensure lat/lng exist (they already do from schema.sql)
-- Also add fields for AI freshness
ALTER TABLE food_listings ADD COLUMN IF NOT EXISTS freshness_label TEXT;  -- e.g. 'Fresh', 'Okay', 'Wilted'

-- 6. Admin seed (password = 'admin1234' bcrypt hash)
-- INSERT INTO users(name,email,role,password_hash,is_verified)
-- VALUES('Admin','admin@foodbridge.local','admin',
--   '$2a$10$rQoX7g8YhEVBz8.AH1T/LOhKQ.4Ir6F/4NqrGwIvxFy3Q.P6xCiSe', TRUE)
-- ON CONFLICT(email) DO NOTHING;

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(is_verified, role);
CREATE INDEX IF NOT EXISTS idx_assignments_pickup ON volunteer_assignments(pickup_id);
