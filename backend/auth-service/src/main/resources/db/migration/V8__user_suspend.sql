-- MODERATION: admins can suspend/unsuspend accounts. Suspended users cannot
-- log in or refresh tokens (existing sessions die within 15 minutes).
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE;
