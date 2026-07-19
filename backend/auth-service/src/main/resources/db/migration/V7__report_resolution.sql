-- DISPUTE RESOLUTION: admins can now move reports out of OPEN
-- (OPEN -> REVIEWING -> RESOLVED | DISMISSED). Resolving/dismissing a
-- PAYMENT_PROBLEM report lifts the payout hold on its booking.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution_note TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
