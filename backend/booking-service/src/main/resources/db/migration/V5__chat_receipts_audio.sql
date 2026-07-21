-- CHAT: read receipts (✓ sent / ✓✓ read) + voice messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS audio_url VARCHAR(500);
