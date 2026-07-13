-- SUBSCRIPTIONS: worker plan (FREE default / PRO while plan_expires_at is in the future)
ALTER TABLE workers ADD COLUMN IF NOT EXISTS plan VARCHAR(255);
ALTER TABLE workers ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP;
