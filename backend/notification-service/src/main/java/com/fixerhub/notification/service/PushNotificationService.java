package com.fixerhub.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class PushNotificationService {

    /**
     * Stub for push notifications via Firebase Cloud Messaging (FCM).
     * Replace with actual FCM API calls.
     */
    public void sendPush(String deviceToken, String title, String body) {
        log.info("PUSH -> token={} | title={} | body={}", deviceToken, title, body);
        // TODO: Integrate Firebase Admin SDK here
    }
}
