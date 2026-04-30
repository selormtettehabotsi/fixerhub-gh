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
            Long bookingId = Long.parseLong(message.split(":")[1]);
            // In production, fetch customer/worker details from respective services
            smsService.sendSms("0241234567", "Your booking #" + bookingId + " is complete!");
            pushNotificationService.sendPush("device-token-placeholder",
                    "Booking Complete", "Your job #" + bookingId + " has been completed.");
        }
    }
}
