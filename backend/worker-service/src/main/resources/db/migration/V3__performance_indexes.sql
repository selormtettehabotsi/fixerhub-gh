-- PERFORMANCE: worker profiles are resolved by user_id on every self-service
-- call, filtered by skill in search, and by verification status in the KYC queue.
CREATE INDEX IF NOT EXISTS idx_workers_user      ON workers (user_id);
CREATE INDEX IF NOT EXISTS idx_workers_skill     ON workers (skill);
CREATE INDEX IF NOT EXISTS idx_workers_available ON workers (available);
CREATE INDEX IF NOT EXISTS idx_workers_kyc       ON workers (verification_status);
CREATE INDEX IF NOT EXISTS idx_portfolio_worker  ON worker_portfolio (worker_id);
