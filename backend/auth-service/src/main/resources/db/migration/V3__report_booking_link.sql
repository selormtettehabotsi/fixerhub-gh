-- M6: link reports to bookings so an open PAYMENT_PROBLEM report can hold
-- that booking's automatic worker payout until an admin resolves it.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS booking_id BIGINT;
