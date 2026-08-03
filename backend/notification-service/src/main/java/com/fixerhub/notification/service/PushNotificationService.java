package com.fixerhub.notification.service;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class PushNotificationService {

    public void sendPush(String deviceToken, String title, String body) {
        sendPush(deviceToken, title, body, null, null);
    }

    /**
     * @param type      e.g. BOOKING / PAYMENT — mirrors the in-app inbox type
     * @param bookingId when present, the app deep-links the tap to this booking
     *
     * The data payload matters: without it a tapped notification can only open
     * the notification centre, because an FCM `notification` block carries no
     * application fields. bookingId was already being recorded in the in-app
     * inbox — this puts it on the push itself so both routes behave the same.
     */
    public void sendPush(String deviceToken, String title, String body,
                         String type, Long bookingId) {
        if (FirebaseApp.getApps().isEmpty()) {
            log.warn("Firebase not initialized. Skipping push to token: {}", deviceToken);
            return;
        }

        // Skip placeholder tokens. A real FCM token is "<instanceId>:APA91b…";
        // anything without a colon is a device id or leftover stub and would
        // just draw an error back from Firebase.
        if (deviceToken == null || deviceToken.contains("placeholder")
                || !deviceToken.contains(":")) {
            log.info("Skipping push - not a valid FCM token: {}", deviceToken);
            return;
        }

        try {
            Message.Builder builder = Message.builder()
                    .setNotification(Notification.builder()
                            .setTitle(title)
                            .setBody(body)
                            .build())
                    .setToken(deviceToken);

            if (type != null) builder.putData("type", type);
            if (bookingId != null) builder.putData("bookingId", String.valueOf(bookingId));

            Message message = builder.build();

            String response = FirebaseMessaging.getInstance().send(message);
            log.info("Push notification sent. FCM message ID: {}", response);
        } catch (Exception e) {
            log.error("Failed to send push notification to token {}: {}", deviceToken, e.getMessage());
        }
    }
}
