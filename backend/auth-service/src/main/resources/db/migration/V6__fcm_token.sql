-- PUSH: FCM device token per user (registered by the app on login)
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(512);
