package com.fixerhub.booking.kafka;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class BookingEventPublisher {

    private static final String TOPIC = "booking-events";
    private final KafkaTemplate<String, String> kafkaTemplate;

    // Message format: COMPLETED:<bookingId>:<customerId>:<customerPhone>:<amount>:<workerId>
    public void publishBookingCompleted(Long bookingId, Long customerId, String customerPhone, Double amount, Long workerId) {
        String phone    = customerPhone != null ? customerPhone : "";
        String custId   = customerId != null ? String.valueOf(customerId) : "";
        String amt      = amount != null ? String.valueOf(amount) : "0.0";
        String wrkId    = workerId != null ? String.valueOf(workerId) : "";
        String message  = "COMPLETED:" + bookingId + ":" + custId + ":" + phone + ":" + amt + ":" + wrkId;
        kafkaTemplate.send(TOPIC, message);
        log.info("Published booking-completed event: {}", message);
    }
}
