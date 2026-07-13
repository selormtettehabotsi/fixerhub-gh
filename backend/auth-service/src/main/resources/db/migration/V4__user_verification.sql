-- VERIFICATION: users can verify their email (mail OTP) and phone (SMS OTP).
-- Badge-only: verification is displayed, not enforced.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_otp VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_otp_channel VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_otp_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_otp_attempts INTEGER;
