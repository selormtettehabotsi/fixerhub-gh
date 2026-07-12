-- SECURITY (N3): track failed reset-OTP attempts so the 6-digit code can't be
-- brute-forced. The OTP is invalidated after 5 wrong guesses.
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_attempts INTEGER;
