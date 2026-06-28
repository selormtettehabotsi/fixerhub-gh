package com.fixerhub.payment.kafka;

import com.fixerhub.payment.model.Payment;
import com.fixerhub.payment.model.PaymentStatus;
import com.fixerhub.payment.repository.PaymentRepository;
import com.fixerhub.payment.service.MomoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobCompletedConsumer {

    private final MomoService momoService;
    private final PaymentRepository paymentRepository;

    @Value("${fixerhub.commission-rate}")
    private double commissionRate;

    // Message format: "COMPLETED:<bookingId>:<customerId>:<customerPhone>:<amount>"
    @KafkaListener(topics = "booking-events", groupId = "payment-group")
    public void consume(String message) {
        log.info("Payment service received event: {}", message);

        if (!message.startsWith("COMPLETED:")) {
            log.warn("Ignoring unknown event format: {}", message);
            return;
        }

        try {
            // Format: COMPLETED:<bookingId>:<customerId>:<customerPhone>:<amount>:<workerId>
            String[] parts = message.split(":");
            Long bookingId    = Long.parseLong(parts[1].trim());
            Long customerId   = (parts.length > 2 && !parts[2].trim().isEmpty())
                                 ? Long.parseLong(parts[2].trim()) : null;
            String phone      = (parts.length > 3 && !parts[3].trim().isEmpty())
                                 ? parts[3].trim() : null;
            Double amount     = (parts.length > 4 && !parts[4].trim().isEmpty())
                                 ? Double.parseDouble(parts[4].trim()) : 0.0;
            Long workerId     = (parts.length > 5 && !parts[5].trim().isEmpty())
                                 ? Long.parseLong(parts[5].trim()) : null;

            if (paymentRepository.findByBookingId(bookingId).isPresent()) {
                log.info("Payment already exists for bookingId={}, skipping", bookingId);
                return;
            }

            // Calculate commission
            double commissionAmount = amount * commissionRate;
            double workerAmount     = amount - commissionAmount;

            log.info("Booking #{} | Worker #{} | Total: {} | Commission ({}%): {} | Worker receives: {}",
                    bookingId, workerId, amount, (commissionRate * 100), commissionAmount, workerAmount);

            String momoRef = momoService.processPayment(bookingId, amount, phone);

            Payment payment = Payment.builder()
                    .bookingId(bookingId)
                    .customerId(customerId)
                    .workerId(workerId)
                    .amount(amount)
                    .commissionRate(commissionRate)
                    .commissionAmount(commissionAmount)
                    .workerAmount(workerAmount)
                    .status(PaymentStatus.SUCCESS)
                    .momoReference(momoRef)
                    .build();

            paymentRepository.save(payment);
            log.info("Payment saved — bookingId={}, total={}, commission={}, workerPayout={}, ref={}",
                    bookingId, amount, commissionAmount, workerAmount, momoRef);

        } catch (Exception e) {
            log.error("Failed to process payment event: {}", e.getMessage());
        }
    }
}
