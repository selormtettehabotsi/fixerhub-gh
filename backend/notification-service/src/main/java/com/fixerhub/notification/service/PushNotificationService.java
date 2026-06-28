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
        if (FirebaseApp.getApps().isEmpty()) {
            log.warn("Firebase not initialized. Skipping push to token: {}", deviceToken);
            return;
        }

        // Skip placeholder tokens
        if (deviceToken == null || deviceToken.contains("placeholder")) {
            log.info("Skipping push notification - no real device token provided.");
            return;
        }

        try {
            Message message = Message.builder()
                    .setNotification(Notification.builder()
                            .setTitle(title)
                            .setBody(body)
                            .build())
                    .setToken(deviceToken)
                    .build();

            String response = FirebaseMessaging.getInstance().send(message);
            log.info("Push notification sent. FCM message ID: {}", response);
        } catch (Exception e) {
            log.error("Failed to send push notification to token {}: {}", deviceToken, e.getMessage());
        }
    }
}
