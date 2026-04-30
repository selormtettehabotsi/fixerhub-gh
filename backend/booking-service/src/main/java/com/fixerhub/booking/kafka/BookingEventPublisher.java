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

    public void publishBookingCompleted(Long bookingId) {
        String message = "COMPLETED:" + bookingId;
        kafkaTemplate.send(TOPIC, message);
        log.info("Published booking-completed event for bookingId={}", bookingId);
    }
}
