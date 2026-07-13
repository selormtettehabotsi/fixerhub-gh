-- RETENTION: recurring bookings (completing one auto-creates the next)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence VARCHAR(255);
