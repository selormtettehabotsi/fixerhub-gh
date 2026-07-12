package com.fixerhub.booking.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * EVENTS (H4): booking events are published as structured JSON with named
 * fields, replacing the fragile colon-delimited strings. Consumers keep a
 * legacy fallback parser for messages already in the topic.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BookingEventPublisher {

    private static final String TOPIC = "booking-events";
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public void publishBookingCompleted(Long bookingId, Long customerId, String customerPhone,
                                        BigDecimal amount, Long workerId) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", "COMPLETED");
        event.put("bookingId", bookingId);
        event.put("customerId", customerId);
        event.put("customerPhone", customerPhone);
        event.put("amount", amount != null ? amount : BigDecimal.ZERO);
        event.put("workerId", workerId);
        send(event, "booking-completed");
    }

    public void publishStatusUpdate(Long bookingId, String status, Long workerId) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", "STATUS_UPDATE");
        event.put("bookingId", bookingId);
        event.put("status", status);
        event.put("workerId", workerId);
        send(event, "status-update");
    }

    public void publishQuoteSubmitted(Long bookingId, Long customerId, BigDecimal quotedAmount) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", "QUOTE_SUBMITTED");
        event.put("bookingId", bookingId);
        event.put("customerId", customerId);
        event.put("quotedAmount", quotedAmount);
        send(event, "quote-submitted");
    }

    private void send(Map<String, Object> event, String label) {
        try {
            String message = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(TOPIC, message);
            log.info("Published {} event: {}", label, message);
        } catch (Exception e) {
            log.warn("Kafka unavailable — {} event NOT published ({}): {}", label, event, e.getMessage());
        }
    }
}
