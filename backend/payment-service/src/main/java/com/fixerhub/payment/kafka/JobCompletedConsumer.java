package com.fixerhub.payment.kafka;

import com.fixerhub.payment.model.Payment;
import com.fixerhub.payment.model.PaymentStatus;
import com.fixerhub.payment.repository.PaymentRepository;
import com.fixerhub.payment.service.MomoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobCompletedConsumer {

    private final MomoService momoService;
    private final PaymentRepository paymentRepository;

    // booking-service publishes: "COMPLETED:<bookingId>"
    @KafkaListener(topics = "booking-events", groupId = "payment-group")
    public void consume(String message) {
        log.info("Payment service received event: {}", message);

        if (!message.startsWith("COMPLETED:")) {
            log.warn("Ignoring unknown event format: {}", message);
            return;
        }

        try {
            Long bookingId = Long.parseLong(message.split(":")[1].trim());

            // Check if payment already exists for this booking
            if (paymentRepository.findByBookingId(bookingId).isPresent()) {
                log.info("Payment already exists for bookingId={}, skipping", bookingId);
                return;
            }

            String momoRef = momoService.processPayment(bookingId, 0.0);

            Payment payment = Payment.builder()
                    .bookingId(bookingId)
                    .amount(0.0)
                    .status(PaymentStatus.SUCCESS)
                    .momoReference(momoRef)
                    .build();

            paymentRepository.save(payment);
            log.info("Payment saved for bookingId={}, ref={}", bookingId, momoRef);

        } catch (Exception e) {
            log.error("Failed to process payment event: {}", e.getMessage());
        }
    }
}
