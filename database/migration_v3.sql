-- FoodBridge v3 migration: WebPush & Notification preferences
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);

-- Optional phone notification preference flag on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE;
