-- PERFORMANCE: index the foreign keys every hot query filters on. Without these
-- each booking list / chat open was a sequential scan of the whole table.
CREATE INDEX IF NOT EXISTS idx_bookings_customer   ON bookings (customer_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_worker     ON bookings (worker_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_created    ON bookings (created_at);

-- Chat history + unread counts filter by conversation and sort by time.
CREATE INDEX IF NOT EXISTS idx_chat_conversation   ON chat_messages (conversation_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_booking        ON chat_messages (booking_id);

-- Favorites are looked up per customer ("Your Workers" row).
CREATE INDEX IF NOT EXISTS idx_favorites_customer  ON favorites (customer_user_id);
