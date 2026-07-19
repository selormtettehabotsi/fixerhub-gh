package com.fixerhub.payment.service;

import com.fixerhub.payment.dto.PaymentResponse;
import com.fixerhub.payment.exception.BadRequestException;
import com.fixerhub.payment.exception.NotFoundException;
import com.fixerhub.payment.model.Payment;
import com.fixerhub.payment.model.PaymentStatus;
import com.fixerhub.payment.repository.PaymentRepository;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final PaystackService paystackService;
    private final RestTemplate loadBalancedRestTemplate;
    private final ReceiptNotificationClient receiptNotificationClient;

    /** MONEY (H2): commission rate as exact decimal (e.g. 0.05). */
    @Value("${fixerhub.commission-rate}")
    private BigDecimal commissionRate;

    public PaymentService(PaymentRepository paymentRepository,
                          PaystackService paystackService,
                          @Qualifier("loadBalancedRestTemplate") RestTemplate loadBalancedRestTemplate,
                          ReceiptNotificationClient receiptNotificationClient) {
        this.paymentRepository = paymentRepository;
        this.paystackService = paystackService;
        this.loadBalancedRestTemplate = loadBalancedRestTemplate;
        this.receiptNotificationClient = receiptNotificationClient;
    }

    // ── Verification / settlement (shared by customer verify + webhook) ────

    /**
     * Verifies with Paystack, VALIDATES THE AMOUNT PAID against the booking
     * amount, atomically claims SUCCESS (N10), then sends the receipt and
     * starts the worker payout. Idempotent — safe to call from both the
     * customer's "I've paid" tap and the Paystack webhook.
     */
    public String confirmAndSettle(Payment payment) {
        if (payment.getStatus() == PaymentStatus.SUCCESS) return "success";

        PaystackService.VerifyResult result = paystackService.verifyTransaction(payment.getPaystackReference());
        if (!"success".equals(result.status())) {
            payment.setPaystackStatus(result.status());
            payment.setStatus(PaymentStatus.FAILED);
            paymentRepository.save(payment);
            return result.status();
        }

        // AMOUNT VALIDATION: what was actually charged must equal the booking amount.
        long expectedPesewas = PaystackService.toPesewas(payment.getAmount());
        if (result.amountPesewas() == null || result.amountPesewas() != expectedPesewas) {
            log.error("AMOUNT MISMATCH for booking {}: expected {} pesewas, Paystack reports {} — NOT settling",
                    payment.getBookingId(), expectedPesewas, result.amountPesewas());
            payment.setPaystackStatus("amount_mismatch");
            paymentRepository.save(payment);
            return "amount_mismatch";
        }

        int claimed = paymentRepository.claimSuccess(payment.getId(), PaymentStatus.SUCCESS);
        if (claimed == 0) return "success"; // another caller settled it first

        payment.setStatus(PaymentStatus.SUCCESS);
        payment.setPaystackStatus("success");
        receiptNotificationClient.sendPaymentReceipt(payment);
        initiateWorkerPayout(payment);

        // REFERRALS: a completed first payment credits the payer's referrer.
        // Best effort — never blocks settlement.
        try {
            loadBalancedRestTemplate.postForEntity(
                    "http://auth-service/auth/internal/referrals/first-payment/" + payment.getCustomerId(),
                    null, Void.class);
        } catch (Exception e) {
            log.warn("Referral credit call failed for userId={}: {}", payment.getCustomerId(), e.getMessage());
        }
        return "success";
    }

    // ── Refunds ─────────────────────────────────────────────────────────────

    /**
     * REFUND (admin only, e.g. paid job cancelled or dispute upheld): full
     * refund via Paystack. Blocked once the worker payout has gone out —
     * refunding then would make the platform pay twice.
     */
    public Map<String, String> refundPayment(Long bookingId) {
        Payment payment = paymentRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new NotFoundException("Payment not found for booking " + bookingId));
        if (payment.getStatus() != PaymentStatus.SUCCESS) {
            throw new BadRequestException("Only successful payments can be refunded (current: " + payment.getStatus() + ")");
        }
        if ("success".equalsIgnoreCase(payment.getPayoutStatus())) {
            throw new BadRequestException("Worker has already been paid out — resolve via a report/dispute instead");
        }
        String refundStatus = paystackService.refundTransaction(payment.getPaystackReference());
        payment.setStatus(PaymentStatus.REFUNDED);
        payment.setPaystackStatus("refunded");
        payment.setPayoutStatus("cancelled");
        paymentRepository.save(payment);
        log.info("Refund for booking {} initiated — Paystack status: {}", bookingId, refundStatus);
        return Map.of("status", "refunded", "paystackRefundStatus", refundStatus);
    }

    // ── Admin charts ────────────────────────────────────────────────────────

    /** ADMIN CHARTS: settled revenue per day for the last `days` days (zero-filled). */
    public java.util.List<Map<String, Object>> revenuePerDay(int days) {
        int d = Math.min(Math.max(days, 1), 90);
        java.time.LocalDate start = java.time.LocalDate.now().minusDays(d - 1L);
        java.util.Map<String, BigDecimal> totals = new java.util.LinkedHashMap<>();
        for (int i = 0; i < d; i++) totals.put(start.plusDays(i).toString(), BigDecimal.ZERO);
        for (Object[] row : paymentRepository.revenuePerDaySince(start.atStartOfDay())) {
            totals.put(String.valueOf(row[0]), new BigDecimal(String.valueOf(row[1])));
        }
        return totals.entrySet().stream()
                .map(e -> Map.<String, Object>of("date", e.getKey(), "amount", e.getValue()))
                .collect(java.util.stream.Collectors.toList());
    }

    // ── Payout release (dispute resolution) ─────────────────────────────────

    /**
     * DISPUTE RESOLUTION (admin only): re-runs the worker payout for a settled
     * payment whose payout is 'held' (open dispute) or 'failed'. The payout
     * pipeline re-checks the dispute status with auth-service, so if the
     * report is still open the payout simply goes back to 'held'.
     */
    public Map<String, String> releasePayout(Long bookingId) {
        Payment payment = paymentRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new NotFoundException("Payment not found for booking " + bookingId));
        if (payment.getStatus() != PaymentStatus.SUCCESS) {
            throw new BadRequestException(
                    "No settled payment to pay out (payment status: " + payment.getStatus() + ")");
        }
        String before = payment.getPayoutStatus();
        if ("success".equalsIgnoreCase(before)) {
            return Map.of("status", "already_paid", "payoutStatus", "success");
        }
        if ("processing".equalsIgnoreCase(before)) {
            return Map.of("status", "in_progress", "payoutStatus", "processing");
        }
        initiateWorkerPayout(payment);
        String after = payment.getPayoutStatus() == null ? "unknown" : payment.getPayoutStatus();
        String status = switch (after) {
            case "success" -> "released";
            case "held" -> "still_held";      // dispute still open on auth-service
            default -> after;                  // failed / unknown
        };
        return Map.of("status", status, "payoutStatus", after);
    }

    // ── Inner DTOs ──────────────────────────────────────────────────────────

    @Data
    @NoArgsConstructor
    public static class WorkerPayoutInfo {
        private Long id;
        private String name;
        private String phone;
        /** "MTN" | "VODAFONE" | "AIRTELTIGO" — worker's chosen MoMo network */
        private String momoNetwork;
    }

    @Data
    @NoArgsConstructor
    public static class BookingDetails {
        private Long id;
        private Long customerId;
        private Long workerId;
        private String workerName;
        private String serviceType;
        private String status;
        private BigDecimal amount;
        private BigDecimal minAmount;
        private BigDecimal maxAmount;
        private String customerPhone;
        private BigDecimal quotedAmount;
    }

    @Data
    @NoArgsConstructor
    public static class UserInfo {
        private Long id;
        private String email;
        private String name;
    }

    // ── Pay URL: return existing or create on demand ─────────────────────────

    /**
     * Returns the Paystack authorization URL for a completed booking.
     * If no payment record exists (Kafka missed the event or Paystack init failed),
     * the payment is initialized on demand so the customer is never stuck.
     */
    public Map<String, String> getOrCreatePayUrl(Long bookingId) {
        Optional<Payment> existing = paymentRepository.findByBookingId(bookingId);

        // Happy path: payment was already initialized by Kafka consumer
        if (existing.isPresent()
                && existing.get().getAuthorizationUrl() != null
                && !existing.get().getAuthorizationUrl().isBlank()) {
            Payment p = existing.get();
            return Map.of(
                    "authorizationUrl", p.getAuthorizationUrl(),
                    "reference", p.getPaystackReference() != null ? p.getPaystackReference() : "");
        }

        // Payment missing or incomplete — create / re-initialize on demand
        log.info("No valid payment record for bookingId={} — initializing Paystack on demand", bookingId);

        BookingDetails booking = fetchBookingDetails(bookingId);
        if (booking == null) {
            throw new NotFoundException("Booking " + bookingId + " not found — cannot initialize payment.");
        }

        BigDecimal amount = resolveAmount(booking).setScale(2, RoundingMode.HALF_UP);
        if (amount.signum() <= 0) {
            throw new BadRequestException(
                    "Booking " + bookingId + " has no payable amount. Please contact support.");
        }

        String customerEmail = fetchCustomerEmail(booking.getCustomerId());
        Map<String, String> ps = paystackService.initializePayment(customerEmail, amount, bookingId);

        // MONEY (H2): 2dp HALF_UP commission math; worker gets the exact remainder
        BigDecimal commission = amount.multiply(commissionRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal workerAmt  = amount.subtract(commission);

        // Reuse existing record if partial, otherwise create fresh
        Payment payment = existing.orElseGet(() -> Payment.builder()
                .bookingId(bookingId)
                .customerId(booking.getCustomerId())
                .workerId(booking.getWorkerId())
                .amount(amount)
                .commissionRate(commissionRate)
                .commissionAmount(commission)
                .workerAmount(workerAmt)
                .customerPhone(booking.getCustomerPhone())
                .workerName(booking.getWorkerName())
                .serviceType(booking.getServiceType())
                .build());

        payment.setPaystackReference(ps.get("reference"));
        payment.setAuthorizationUrl(ps.get("authorizationUrl"));
        payment.setStatus(PaymentStatus.PENDING);
        payment.setPaystackStatus("pending");
        paymentRepository.save(payment);

        log.info("Paystack initialized on demand — bookingId={}, ref={}", bookingId, ps.get("reference"));
        return Map.of(
                "authorizationUrl", ps.get("authorizationUrl"),
                "reference", ps.get("reference"));
    }

    // ── Standard query methods ──────────────────────────────────────────────

    public PaymentResponse getPaymentByBookingId(Long bookingId) {
        Payment payment = paymentRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new NotFoundException("Payment not found for bookingId: " + bookingId));
        return toResponse(payment);
    }

    /** M2: bounded pages (newest first, max 100 per call). */
    public List<PaymentResponse> getPaymentsByCustomer(Long customerId, int page, int size) {
        return paymentRepository.findByCustomerIdOrderByIdDesc(customerId, pageOf(page, size))
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<PaymentResponse> getPaymentsByWorker(Long workerId, int page, int size) {
        return paymentRepository.findByWorkerIdOrderByIdDesc(workerId, pageOf(page, size))
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    private static org.springframework.data.domain.Pageable pageOf(int page, int size) {
        return org.springframework.data.domain.PageRequest.of(
                Math.max(0, page), Math.min(Math.max(1, size), 100));
    }

    public Map<String, Object> getWorkerPaymentSummary(Long workerId) {
        // M2: aggregate in SQL instead of loading the worker's full payment history
        return Map.of(
                "totalEarned", paymentRepository.sumWorkerAmountByWorkerId(workerId),
                "totalJobs", paymentRepository.countByWorkerId(workerId),
                "pendingPayout", BigDecimal.ZERO
        );
    }

    public Map<String, BigDecimal> getTotalRevenue() {
        // M2: SQL SUM aggregates instead of loading every payment row into memory
        return Map.of(
                "totalRevenue", paymentRepository.sumAmount(),
                "totalCommission", paymentRepository.sumCommission(),
                "totalWorkerPayouts", paymentRepository.sumWorkerPayouts());
    }

    // ── Worker payout ───────────────────────────────────────────────────────

    /**
     * Initiates a Paystack Transfer of the worker's share (after commission) to their mobile money.
     * Called after verifyPayment() succeeds. Runs inside a try-catch so payout failure
     * never blocks the customer-facing verification response.
     */
    public void initiateWorkerPayout(Payment payment) {
        try {
            // IDEMPOTENCY (H3): only pay out from a null, failed or held state.
            // A payout already processing/successful must never fire twice.
            String payoutStatus = payment.getPayoutStatus();
            if (payoutStatus != null && !"failed".equals(payoutStatus) && !"held".equals(payoutStatus)) {
                log.info("Worker payout skipped: payoutStatus='{}' for payment id={} (already initiated)",
                        payoutStatus, payment.getId());
                return;
            }

            // DISPUTES (M6): an unresolved PAYMENT_PROBLEM report for this booking
            // pauses the automatic payout until an admin marks it RESOLVED.
            if (isPayoutHeldByDispute(payment.getBookingId())) {
                payment.setPayoutStatus("held");
                paymentRepository.save(payment);
                log.warn("Worker payout HELD for bookingId={} — open payment dispute", payment.getBookingId());
                return;
            }

            Long workerId = payment.getWorkerId();
            if (workerId == null) {
                log.warn("Worker payout skipped: no workerId on payment id={}", payment.getId());
                return;
            }

            BigDecimal payoutAmount = payment.getWorkerAmount() != null ? payment.getWorkerAmount() : BigDecimal.ZERO;
            if (payoutAmount.signum() <= 0) {
                log.warn("Worker payout skipped: workerAmount is {} for payment id={}", payoutAmount, payment.getId());
                return;
            }

            // Claim the payout before calling Paystack so a concurrent/replayed
            // verify sees 'processing' and skips.
            payment.setPayoutStatus("processing");
            paymentRepository.save(payment);

            // Fetch worker's phone and momoNetwork from worker-service
            WorkerPayoutInfo workerInfo = loadBalancedRestTemplate.getForObject(
                    "http://worker-service/workers/internal/" + workerId, WorkerPayoutInfo.class);

            if (workerInfo == null || workerInfo.getPhone() == null || workerInfo.getPhone().isBlank()) {
                log.warn("Worker payout skipped: could not fetch worker phone for workerId={}", workerId);
                payment.setPayoutStatus("failed");
                paymentRepository.save(payment);
                return;
            }

            String momoNetwork = workerInfo.getMomoNetwork() != null ? workerInfo.getMomoNetwork() : "MTN";
            String bankCode    = toBankCode(momoNetwork);
            String workerName  = workerInfo.getName() != null ? workerInfo.getName() : "Worker";

            log.info("Initiating payout to workerId={} | phone={} | network={} | amount={} GHS",
                    workerId, workerInfo.getPhone(), momoNetwork, payoutAmount);

            // Step 1: create Paystack transfer recipient
            String recipientCode = paystackService.createTransferRecipient(
                    workerName, workerInfo.getPhone(), bankCode);

            // Step 2: initiate transfer
            String transferRef = paystackService.initiateTransfer(
                    payoutAmount, recipientCode, payment.getBookingId());

            payment.setPayoutStatus("success");
            payment.setPayoutReference(transferRef);
            paymentRepository.save(payment);

            log.info("Worker payout initiated successfully — bookingId={}, amount={} GHS, ref={}",
                    payment.getBookingId(), payoutAmount, transferRef);

        } catch (Exception e) {
            log.error("Worker payout failed for payment id={}, bookingId={}: {}",
                    payment.getId(), payment.getBookingId(), e.getMessage());
            try {
                payment.setPayoutStatus("failed");
                paymentRepository.save(payment);
            } catch (Exception ex) {
                log.error("Failed to save payout failure status: {}", ex.getMessage());
            }
        }
    }

    /** Maps a worker's momoNetwork value to the Paystack Ghana bank code. */
    private static String toBankCode(String momoNetwork) {
        if (momoNetwork == null) return "MTN";
        return switch (momoNetwork.toUpperCase()) {
            case "VODAFONE" -> "VDF";
            case "AIRTELTIGO" -> "ATL";
            default -> "MTN"; // MTN's Paystack bank_code is also "MTN"
        };
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    /** Picks the best non-zero amount from a booking: fixed > quoted > mid(min,max) > min > max. */
    private BigDecimal resolveAmount(BookingDetails b) {
        if (isPositive(b.getAmount()))       return b.getAmount();
        if (isPositive(b.getQuotedAmount())) return b.getQuotedAmount();
        if (b.getMinAmount() != null && b.getMaxAmount() != null)
            return b.getMinAmount().add(b.getMaxAmount()).divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
        if (isPositive(b.getMinAmount()))    return b.getMinAmount();
        if (isPositive(b.getMaxAmount()))    return b.getMaxAmount();
        return BigDecimal.ZERO;
    }

    private static boolean isPositive(BigDecimal v) {
        return v != null && v.signum() > 0;
    }

    /** M6: asks auth-service whether an unresolved PAYMENT_PROBLEM report exists.
     *  Fails open (no hold) if auth-service is unreachable — payouts shouldn't
     *  depend on a side service being up; the H3 state machine still protects us. */
    @SuppressWarnings("unchecked")
    private boolean isPayoutHeldByDispute(Long bookingId) {
        try {
            Map<String, Boolean> res = loadBalancedRestTemplate.getForObject(
                    "http://auth-service/auth/internal/reports/payment-hold/" + bookingId, Map.class);
            return res != null && Boolean.TRUE.equals(res.get("held"));
        } catch (Exception e) {
            log.warn("Dispute check failed for bookingId={} — proceeding without hold: {}", bookingId, e.getMessage());
            return false;
        }
    }

    private BookingDetails fetchBookingDetails(Long bookingId) {
        try {
            return loadBalancedRestTemplate.getForObject(
                    "http://booking-service/bookings/internal/" + bookingId, BookingDetails.class);
        } catch (Exception e) {
            log.warn("Could not fetch booking details for bookingId={}: {}", bookingId, e.getMessage());
            return null;
        }
    }

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

    private PaymentResponse toResponse(Payment p) {
        return PaymentResponse.builder()
                .id(p.getId())
                .bookingId(p.getBookingId())
                .customerId(p.getCustomerId())
                .workerId(p.getWorkerId())
                .amount(p.getAmount())
                .commissionRate(p.getCommissionRate())
                .commissionAmount(p.getCommissionAmount())
                .workerAmount(p.getWorkerAmount())
                .status(p.getStatus() != null ? p.getStatus().name() : null)
                .paystackReference(p.getPaystackReference())
                .paystackStatus(p.getPaystackStatus())
                .authorizationUrl(p.getAuthorizationUrl())
                .serviceType(p.getServiceType())
                .workerName(p.getWorkerName())
                .payoutStatus(p.getPayoutStatus())
                .payoutReference(p.getPayoutReference())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
