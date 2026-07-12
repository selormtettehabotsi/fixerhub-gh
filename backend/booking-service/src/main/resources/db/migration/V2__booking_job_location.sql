-- JOB LOCATION: where the customer was when they created the booking, so the
-- worker can see the destination on the live-tracking map.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_lat DOUBLE PRECISION;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_lng DOUBLE PRECISION;
