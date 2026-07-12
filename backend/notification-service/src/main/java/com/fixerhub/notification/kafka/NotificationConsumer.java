package com.fixerhub.notification.kafka;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "booking-events", groupId = "notification-service")
    public void consume(String message) {
        log.info("Notification service received event: {}", message);
        if (message == null || message.isBlank()) return;

        // EVENTS (H4): JSON first, legacy colon-delimited format as fallback.
        if (message.trim().startsWith("{")) {
            try {
                JsonNode node = objectMapper.readTree(message);
                handleEvent(
                        node.path("type").asText(""),
                        node.path("bookingId").isNumber() ? node.path("bookingId").asLong() : null,
                        node.path("customerPhone").isTextual() ? node.path("customerPhone").asText() : null,
                        node.path("status").isTextual() ? node.path("status").asText() : null);
            } catch (Exception e) {
                log.error("Failed to parse JSON booking event: {}", e.getMessage());
            }
            return;
        }
        handleLegacy(message);
    }

    private void handleEvent(String type, Long bookingId, String phoneNumber, String status) {
        if (bookingId == null) {
            log.warn("Ignoring event with no bookingId (type={})", type);
            return;
        }
        switch (type) {
            case "COMPLETED" -> {
                if (phoneNumber != null && !phoneNumber.isEmpty()) {
                    smsService.sendSms(phoneNumber, "Your FixerHub booking #" + bookingId + " is complete!");
                } else {
                    log.info("No phone number in event for booking {}. SMS skipped.", bookingId);
                }
                log.info("No FCM token in event for booking {}. Push notification skipped.", bookingId);
            }
            case "STATUS_UPDATE" -> {
                log.info("Booking #{} status changed to {}", bookingId, status);
                String statusMsg = switch (status != null ? status : "") {
                    case "ACCEPTED"          -> "Your FixerHub booking #" + bookingId + " has been accepted!";
                    case "WORKER_ON_THE_WAY" -> "Great news! Your worker is on the way for booking #" + bookingId;
                    case "IN_PROGRESS"       -> "Your FixerHub job #" + bookingId + " has started!";
                    default                  -> null;
                };
                if (statusMsg != null) {
                    log.info("Status notification ready (no phone in event yet): {}", statusMsg);
                }
            }
            case "QUOTE_SUBMITTED" ->
                log.info("Quote submitted for booking #{} — customer will be notified via polling", bookingId);
            default -> log.warn("Ignoring unknown event type: {}", type);
        }
    }

    /** Legacy colon-delimited formats still sitting in the topic. */
    private void handleLegacy(String message) {
        try {
            if (message.startsWith("COMPLETED:")) {
                String[] parts = message.split(":");
                handleEvent("COMPLETED", Long.parseLong(parts[1].trim()),
                        parts.length > 3 ? parts[3].trim() : null, null);
            } else if (message.startsWith("STATUS_UPDATE:")) {
                String[] parts = message.split(":");
                handleEvent("STATUS_UPDATE", Long.parseLong(parts[1].trim()), null,
                        parts.length > 2 ? parts[2].trim() : "");
            } else if (message.startsWith("QUOTE_SUBMITTED:")) {
                String[] parts = message.split(":");
                handleEvent("QUOTE_SUBMITTED", Long.parseLong(parts[1].trim()), null, null);
            } else {
                log.warn("Ignoring unknown event format: {}", message);
            }
        } catch (Exception e) {
            log.error("Failed to parse legacy booking event '{}': {}", message, e.getMessage());
        }
    }
}
