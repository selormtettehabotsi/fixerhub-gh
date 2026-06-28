package com.fixerhub.notification.kafka;

import com.fixerhub.notification.service.PushNotificationService;
import com.fixerhub.notification.service.SmsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationConsumer {

    private final SmsService smsService;
    private final PushNotificationService pushNotificationService;

    @KafkaListener(topics = "booking-events", groupId = "notification-service")
    public void consume(String message) {
        log.info("Notification service received event: {}", message);

        if (message.startsWith("COMPLETED:")) {
            String[] parts = message.split(":");
            Long bookingId = Long.parseLong(parts[1].trim());

            // Format: COMPLETED:<bookingId>:<customerId>:<phoneNumber>
            String phoneNumber = parts.length > 3 ? parts[3].trim() : null;
            String fcmToken    = null; // FCM token not in Kafka message yet — sent separately when frontend integrates

            if (phoneNumber != null && !phoneNumber.isEmpty()) {
                smsService.sendSms(phoneNumber, "Your FixerHub booking #" + bookingId + " is complete!");
            } else {
                log.info("No phone number in event for booking {}. SMS skipped.", bookingId);
            }

            if (fcmToken != null && !fcmToken.isEmpty()) {
                pushNotificationService.sendPush(fcmToken,
                        "Booking Complete", "Your job #" + bookingId + " has been completed.");
            } else {
                log.info("No FCM token in event for booking {}. Push notification skipped.", bookingId);
            }
        }
    }
}
