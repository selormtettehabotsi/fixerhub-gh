-- REFERRALS: shareable code per user; referrer credited when the referred
-- user completes their FIRST successful payment (fraud-resistant by design).
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_count INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_credited BOOLEAN;
CREATE UNIQUE INDEX IF NOT EXISTS uk_users_referral_code ON users (referral_code);
