-- PERFORMANCE: reviews are listed per worker and checked per booking
-- (duplicate-review guard).
CREATE INDEX IF NOT EXISTS idx_reviews_worker  ON reviews (worker_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews (booking_id);
