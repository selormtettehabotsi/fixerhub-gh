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
    private final com.fixerhub.notification.service.LookupClient lookupClient;
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
                        node.path("status").isTextual() ? node.path("status").asText() : null,
                        node.path("customerId").isNumber() ? node.path("customerId").asLong() : null);
            } catch (Exception e) {
                log.error("Failed to parse JSON booking event: {}", e.getMessage());
            }
            return;
        }
        handleLegacy(message);
    }

    private void handleEvent(String type, Long bookingId, String phoneNumber, String status, Long customerId) {
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
                // PUSH: customer gets a push when the job is marked complete
                Long cid = customerId != null ? customerId : lookupClient.customerIdForBooking(bookingId);
                lookupClient.pushToUser(pushNotificationService, cid,
                        "Job complete ✅",
                        "Your booking #" + bookingId + " is done. Open FixerHub to pay and leave a review.",
                        "BOOKING", bookingId);
            }
            case "STATUS_UPDATE" -> {
                log.info("Booking #{} status changed to {}", bookingId, status);
                String statusMsg = switch (status != null ? status : "") {
                    case "ACCEPTED"          -> "Your booking #" + bookingId + " has been accepted!";
                    case "WORKER_ON_THE_WAY" -> "Your worker is on the way — track them live in the app.";
                    case "IN_PROGRESS"       -> "Your job #" + bookingId + " has started.";
                    default                  -> null;
                };
                if (statusMsg != null) {
                    // PUSH: the "phone buzzes when the worker accepts" moment
                    Long cid = customerId != null ? customerId : lookupClient.customerIdForBooking(bookingId);
                    lookupClient.pushToUser(pushNotificationService, cid, "FixerHub", statusMsg,
                            "BOOKING", bookingId);
                }
            }
            case "QUOTE_SUBMITTED" -> {
                Long cid = customerId != null ? customerId : lookupClient.customerIdForBooking(bookingId);
                lookupClient.pushToUser(pushNotificationService, cid,
                        "New quote received",
                        "Your worker sent a quote for booking #" + bookingId + ". Open FixerHub to review it.",
                        "QUOTE", bookingId);
            }
            default -> log.warn("Ignoring unknown event type: {}", type);
        }
    }

    /** Legacy colon-delimited formats still sitting in the topic. */
    private void handleLegacy(String message) {
        try {
            if (message.startsWith("COMPLETED:")) {
                String[] parts = message.split(":");
                handleEvent("COMPLETED", Long.parseLong(parts[1].trim()),
                        parts.length > 3 ? parts[3].trim() : null, null, null);
            } else if (message.startsWith("STATUS_UPDATE:")) {
                String[] parts = message.split(":");
                handleEvent("STATUS_UPDATE", Long.parseLong(parts[1].trim()), null,
                        parts.length > 2 ? parts[2].trim() : "", null);
            } else if (message.startsWith("QUOTE_SUBMITTED:")) {
                String[] parts = message.split(":");
                handleEvent("QUOTE_SUBMITTED", Long.parseLong(parts[1].trim()), null, null, null);
            } else {
                log.warn("Ignoring unknown event format: {}", message);
            }
        } catch (Exception e) {
            log.error("Failed to parse legacy booking event '{}': {}", message, e.getMessage());
        }
    }
}
