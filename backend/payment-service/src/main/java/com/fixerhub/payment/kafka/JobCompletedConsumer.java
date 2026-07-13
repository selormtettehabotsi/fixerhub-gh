package com.fixerhub.payment.kafka;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fixerhub.payment.model.Payment;
import com.fixerhub.payment.model.PaymentStatus;
import com.fixerhub.payment.repository.PaymentRepository;
import com.fixerhub.payment.service.PaystackService;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

@Slf4j
@Service
public class JobCompletedConsumer {

    private final PaystackService paystackService;
    private final PaymentRepository paymentRepository;
    private final RestTemplate loadBalancedRestTemplate;
    private final ObjectMapper objectMapper;

    /** MONEY (H2): commission rate as exact decimal (e.g. 0.05). */
    @Value("${fixerhub.commission-rate}")
    private BigDecimal commissionRate;

    /** SUBSCRIPTIONS: reduced commission for workers on the Pro plan. */
    @Value("${fixerhub.pro-commission-rate:0.03}")
    private BigDecimal proCommissionRate;

    public JobCompletedConsumer(PaystackService paystackService,
                                PaymentRepository paymentRepository,
                                @Qualifier("loadBalancedRestTemplate") RestTemplate loadBalancedRestTemplate,
                                ObjectMapper objectMapper) {
        this.paystackService = paystackService;
        this.paymentRepository = paymentRepository;
        this.loadBalancedRestTemplate = loadBalancedRestTemplate;
        this.objectMapper = objectMapper;
    }

    @Data
    @NoArgsConstructor
    public static class WorkerInfo {
        private Long id;
        private String phone;
        private String name;
        /** SUBSCRIPTIONS: effective plan ("FREE"/"PRO") — Pro pays lower commission. */
        private String plan;
    }

    @Data
    @NoArgsConstructor
    public static class UserInfo {
        private Long id;
        private String email;
        private String name;
    }

    @Data
    @NoArgsConstructor
    public static class BookingInfo {
        private Long id;
        private String serviceType;
        private BigDecimal amount;
        private BigDecimal minAmount;
        private BigDecimal maxAmount;
        private BigDecimal quotedAmount;
    }

    /** Parsed booking-completed event, from either JSON or legacy colon format. */
    record CompletedEvent(Long bookingId, Long customerId, String customerPhone,
                          BigDecimal amount, Long workerId) {}

    @KafkaListener(topics = "booking-events", groupId = "payment-group")
    public void consume(String message) {
        log.info("Payment service received event: {}", message);

        CompletedEvent event = parseCompletedEvent(message);
        if (event == null) return; // not a COMPLETED event (or unparseable — already logged)

        try {
            Long bookingId  = event.bookingId();
            Long customerId = event.customerId();
            String phone    = event.customerPhone();
            Long workerId   = event.workerId();
            BigDecimal amount = event.amount() != null ? event.amount() : BigDecimal.ZERO;

            if (paymentRepository.findByBookingId(bookingId).isPresent()) {
                log.info("Payment already exists for bookingId={}, skipping", bookingId);
                return;
            }

            // Enrich with customer email, worker details and booking info for the receipt
            String customerEmail = fetchCustomerEmail(customerId);
            WorkerInfo worker    = fetchWorker(workerId);
            BookingInfo bookingInfo = fetchServiceType(bookingId);
            String serviceType   = bookingInfo != null ? bookingInfo.getServiceType() : null;

            // Resolve amount: event value may be 0 if booking uses min/max pricing
            if (amount.signum() <= 0 && bookingInfo != null) {
                if (isPositive(bookingInfo.getQuotedAmount())) {
                    amount = bookingInfo.getQuotedAmount();
                } else if (isPositive(bookingInfo.getAmount())) {
                    amount = bookingInfo.getAmount();
                } else if (bookingInfo.getMinAmount() != null && bookingInfo.getMaxAmount() != null) {
                    amount = bookingInfo.getMinAmount().add(bookingInfo.getMaxAmount())
                            .divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
                }
            }
            if (amount.signum() <= 0) {
                log.warn("Booking #{} has no resolvable amount — skipping Paystack init (will be created on demand when customer pays)", bookingId);
                return;
            }

            // MONEY (H2): 2dp HALF_UP commission math; worker gets the exact remainder.
            // SUBSCRIPTIONS: Pro workers pay the reduced rate.
            BigDecimal effectiveRate = (worker != null && "PRO".equals(worker.getPlan()))
                    ? proCommissionRate : commissionRate;
            amount = amount.setScale(2, RoundingMode.HALF_UP);
            BigDecimal commissionAmount = amount.multiply(effectiveRate).setScale(2, RoundingMode.HALF_UP);
            BigDecimal workerAmount     = amount.subtract(commissionAmount);

            log.info("Booking #{} | Worker #{} | Total: {} | Commission: {} | Worker receives: {}",
                    bookingId, workerId, amount, commissionAmount, workerAmount);

            // Initialize a Paystack transaction (customer completes payment later)
            Map<String, String> ps = paystackService.initializePayment(customerEmail, amount, bookingId);

            Payment payment = Payment.builder()
                    .bookingId(bookingId)
                    .customerId(customerId)
                    .workerId(workerId)
                    .amount(amount)
                    .commissionRate(effectiveRate)
                    .commissionAmount(commissionAmount)
                    .workerAmount(workerAmount)
                    .status(PaymentStatus.PENDING)
                    .paystackReference(ps.get("reference"))
                    .authorizationUrl(ps.get("authorizationUrl"))
                    .paystackStatus("pending")
                    .customerEmail(customerEmail)
                    .customerPhone(phone)
                    .workerPhone(worker != null ? worker.getPhone() : null)
                    .workerName(worker != null ? worker.getName() : null)
                    .serviceType(serviceType)
                    .build();

            paymentRepository.save(payment);
            log.info("Paystack payment initialized — bookingId={}, ref={}", bookingId, ps.get("reference"));

        } catch (Exception e) {
            log.error("Failed to process payment event: {}", e.getMessage());
        }
    }

    private static boolean isPositive(BigDecimal v) {
        return v != null && v.signum() > 0;
    }

    // ── Event parsing (H4): JSON first, legacy colon format as fallback ─────

    private CompletedEvent parseCompletedEvent(String message) {
        if (message == null || message.isBlank()) return null;

        if (message.trim().startsWith("{")) {
            try {
                JsonNode node = objectMapper.readTree(message);
                if (!"COMPLETED".equals(node.path("type").asText())) {
                    log.info("Ignoring non-COMPLETED event in payment-group");
                    return null;
                }
                return new CompletedEvent(
                        node.path("bookingId").isNumber() ? node.path("bookingId").asLong() : null,
                        node.path("customerId").isNumber() ? node.path("customerId").asLong() : null,
                        node.path("customerPhone").isTextual() ? node.path("customerPhone").asText() : null,
                        node.path("amount").isNumber() ? node.path("amount").decimalValue() : BigDecimal.ZERO,
                        node.path("workerId").isNumber() ? node.path("workerId").asLong() : null);
            } catch (Exception e) {
                log.error("Failed to parse JSON booking event: {}", e.getMessage());
                return null;
            }
        }

        // Legacy format: COMPLETED:<bookingId>:<customerId>:<customerPhone>:<amount>:<workerId>
        if (!message.startsWith("COMPLETED:")) {
            log.info("Ignoring non-COMPLETED event in payment-group: {}", message);
            return null;
        }
        try {
            String[] parts = message.split(":");
            Long bookingId  = Long.parseLong(parts[1].trim());
            Long customerId = (parts.length > 2 && !parts[2].trim().isEmpty())
                               ? Long.parseLong(parts[2].trim()) : null;
            String phone    = (parts.length > 3 && !parts[3].trim().isEmpty())
                               ? parts[3].trim() : null;
            BigDecimal amount = (parts.length > 4 && !parts[4].trim().isEmpty())
                               ? new BigDecimal(parts[4].trim()) : BigDecimal.ZERO;
            Long workerId   = (parts.length > 5 && !parts[5].trim().isEmpty())
                               ? Long.parseLong(parts[5].trim()) : null;
            return new CompletedEvent(bookingId, customerId, phone, amount, workerId);
        } catch (Exception e) {
            log.error("Failed to parse legacy booking event '{}': {}", message, e.getMessage());
            return null;
        }
    }

    // ── Enrichment lookups ───────────────────────────────────────────────────

    private String fetchCustomerEmail(Long customerId) {
        if (customerId == null) return null;
        try {
            UserInfo user = loadBalancedRestTemplate.getForObject(
                    "http://auth-service/auth/users/" + customerId + "/public", UserInfo.class);
            return user != null ? user.getEmail() : null;
        } catch (Exception e) {
            log.warn("Could not fetch customer email for customerId={}: {}", customerId, e.getMessage());
            return null;
        }
    }

    private WorkerInfo fetchWorker(Long workerId) {
        if (workerId == null) return null;
        try {
            return loadBalancedRestTemplate.getForObject(
                    "http://worker-service/workers/internal/" + workerId, WorkerInfo.class);
        } catch (Exception e) {
            log.warn("Could not fetch worker info for workerId={}: {}", workerId, e.getMessage());
            return null;
        }
    }

    private BookingInfo fetchServiceType(Long bookingId) {
        try {
            return loadBalancedRestTemplate.getForObject(
                    "http://booking-service/bookings/internal/" + bookingId, BookingInfo.class);
        } catch (Exception e) {
            log.warn("Could not fetch booking info for bookingId={}: {}", bookingId, e.getMessage());
            return null;
        }
    }
}
