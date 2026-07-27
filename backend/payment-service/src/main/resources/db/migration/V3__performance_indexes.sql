-- PERFORMANCE: every payment lookup goes through booking_id; the customer and
-- worker history screens filter by their ids; the daily-revenue chart and the
-- unpaid-booking reminder scan by status + created_at.
CREATE INDEX IF NOT EXISTS idx_payments_booking  ON payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments (customer_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_payments_worker   ON payments (worker_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments (status, created_at);
