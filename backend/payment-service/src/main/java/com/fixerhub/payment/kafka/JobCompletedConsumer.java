package com.fixerhub.payment.kafka;

import com.fixerhub.payment.dto.PaymentRequest;
import com.fixerhub.payment.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Slf4j
@Component
@RequiredArgsConstructor
public class JobCompletedConsumer {

    private final PaymentService paymentService;

    @KafkaListener(topics = "booking-events", groupId = "payment-service")
    public void consume(String message) {
        log.info("Received booking event: {}", message);
        if (message.startsWith("COMPLETED:")) {
            Long bookingId = Long.parseLong(message.split(":")[1]);
            log.info("Triggering payment for completed bookingId={}", bookingId);
            // In production, fetch booking amount from booking-service
            // Using a default amount here for demonstration
            PaymentRequest request = new PaymentRequest();
            request.setBookingId(bookingId);
            request.setAmount(BigDecimal.valueOf(50.00));
            request.setMomoNumber("0241234567");
            paymentService.initiatePayment(request);
        }
    }
}
