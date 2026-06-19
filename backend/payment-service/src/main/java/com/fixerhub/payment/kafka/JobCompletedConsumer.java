/*package com.fixerhub.payment.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fixerhub.payment.model.Payment;
import com.fixerhub.payment.model.PaymentStatus;
import com.fixerhub.payment.repository.PaymentRepository;
import com.fixerhub.payment.service.MomoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobCompletedConsumer {

    private final MomoService momoService;
    private final PaymentRepository paymentRepository;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "booking-events", groupId = "payment-group")
    public void consume(String message) {
        try {
            Map<String, Object> data = objectMapper.readValue(message, Map.class);

            Long bookingId = Long.valueOf(data.get("bookingId").toString());
            Long customerId = Long.valueOf(data.get("customerId").toString());
            Long workerId = Long.valueOf(data.get("workerId").toString());
            Double amount = Double.valueOf(data.get("amount").toString());

            String momoReference = momoService.processPayment(bookingId, amount);

            Payment payment = Payment.builder()
                    .bookingId(bookingId)
                    .customerId(customerId)
                    .workerId(workerId)
                    .amount(amount)
                    .status(PaymentStatus.SUCCESS)
                    .momoReference(momoReference)
                    .build();

            paymentRepository.save(payment);

            log.info("Payment processed for booking {}: {}", bookingId, momoReference);

        } catch (Exception e) {
            log.error("Failed to process booking event: {}", message, e);
        }
    }
}

 */