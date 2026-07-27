package com.fixerhub.payment.jobs;

import com.fixerhub.payment.model.Payment;
import com.fixerhub.payment.model.PaymentStatus;
import com.fixerhub.payment.repository.PaymentRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * PAYMENT REMINDERS: a completed job whose customer never tapped "Pay Now" used
 * to sit PENDING forever — the worker had done the work and simply waited with
 * no follow-up anywhere in the system.
 *
 * Every day at 18:00 this nudges customers whose payment has been pending for
 * more than a day but less than a week (so we remind a few times, then stop
 * rather than harassing them). Reminders go out as push + SMS through
 * notification-service, and are best-effort: a failure never affects payments.
 */
@Slf4j
@Component
public class UnpaidBookingReminderJob {

    /** Only chase payments older than this — gives the customer time to pay. */
    private static final int MIN_AGE_HOURS = 24;
    /** Stop chasing after this — beyond it, it's an admin/dispute matter. */
    private static final int MAX_AGE_DAYS = 7;

    private final PaymentRepository paymentRepository;
    private final RestTemplate loadBalancedRestTemplate;

    public UnpaidBookingReminderJob(PaymentRepository paymentRepository,
                                    @Qualifier("loadBalancedRestTemplate") RestTemplate loadBalancedRestTemplate) {
        this.paymentRepository = paymentRepository;
        this.loadBalancedRestTemplate = loadBalancedRestTemplate;
    }

    @Scheduled(cron = "0 0 18 * * *")
    public void remindUnpaidCustomers() {
        LocalDateTime now = LocalDateTime.now();
        List<Payment> pending = paymentRepository.findByStatusAndCreatedAtBetween(
                PaymentStatus.PENDING, now.minusDays(MAX_AGE_DAYS), now.minusHours(MIN_AGE_HOURS));

        log.info("Unpaid-booking reminders: {} pending payment(s) to chase", pending.size());

        for (Payment p : pending) {
            try {
                BigDecimal amount = p.getAmount() != null
                        ? p.getAmount().setScale(2, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO;
                String service = p.getServiceType() != null ? p.getServiceType() : "job";
                String message = "Your " + service + " (booking #" + p.getBookingId() + ") is complete. "
                        + "Please pay GH₵" + amount.toPlainString() + " in the FixerHub app to release "
                        + "payment to your worker.";

                Map<String, String> body = new HashMap<>();
                if (p.getCustomerId() != null) body.put("userId", String.valueOf(p.getCustomerId()));
                body.put("title", "Payment pending 💳");
                body.put("body", message);
                if (p.getCustomerPhone() != null && !p.getCustomerPhone().isBlank()) {
                    body.put("phone", p.getCustomerPhone());
                    body.put("sms", message);
                }
                loadBalancedRestTemplate.postForEntity(
                        "http://notification-service/notifications/push", body, Void.class);
            } catch (Exception e) {
                log.warn("Payment reminder failed for booking {}: {}", p.getBookingId(), e.getMessage());
            }
        }
    }
}
