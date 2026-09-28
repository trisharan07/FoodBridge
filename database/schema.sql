CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TYPE user_role AS ENUM ('donor','ngo','volunteer','admin');
CREATE TYPE listing_status AS ENUM ('available','claimed','picked_up','delivered','expired','cancelled');
CREATE TYPE pickup_status AS ENUM ('pending','assigned','in_transit','delivered');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_name TEXT NOT NULL,
  org_type TEXT NOT NULL,
  address TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  registration_no TEXT
);

CREATE TABLE food_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES users(id),
  food_name TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'servings',
  pickup_from TIMESTAMPTZ NOT NULL,
  pickup_until TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  address TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  image_url TEXT,
  freshness_score NUMERIC(4,2),
  status listing_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_listings_status ON food_listings(status, expires_at);

CREATE TABLE pickups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL UNIQUE REFERENCES food_listings(id),
  ngo_id UUID NOT NULL REFERENCES users(id),
  status pickup_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE volunteer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_id UUID NOT NULL UNIQUE REFERENCES pickups(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_id UUID NOT NULL REFERENCES pickups(id),
  reviewer_id UUID NOT NULL REFERENCES users(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT, entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
