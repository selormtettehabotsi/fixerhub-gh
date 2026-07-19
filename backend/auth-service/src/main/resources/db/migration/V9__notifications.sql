-- NOTIFICATION CENTER: in-app notification history (bell + list in the app).
-- notification-service records every push it fans out here, so users see
-- their history even when FCM delivery wasn't possible (e.g. Expo Go).
CREATE TABLE IF NOT EXISTS notifications (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    title       VARCHAR(255),
    body        TEXT,
    type        VARCHAR(40),
    booking_id  BIGINT,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP(6) DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, id DESC);
