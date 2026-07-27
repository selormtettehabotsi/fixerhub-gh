-- PERFORMANCE: login/lookup paths and the admin report queue.
CREATE INDEX IF NOT EXISTS idx_users_phone        ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_referred_by  ON users (referred_by);
CREATE INDEX IF NOT EXISTS idx_refresh_user       ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status     ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_booking    ON reports (booking_id);
-- users.email already has a UNIQUE constraint (implicit index).
