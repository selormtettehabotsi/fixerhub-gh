package com.fixerhub.payment.controller;

import com.fixerhub.payment.dto.PaymentResponse;
import com.fixerhub.payment.exception.NotFoundException;
import com.fixerhub.payment.model.Payment;
import com.fixerhub.payment.model.PaymentStatus;
import com.fixerhub.payment.repository.PaymentRepository;
import com.fixerhub.payment.service.PaymentAccessGuard;
import com.fixerhub.payment.service.PaymentService;
import com.fixerhub.payment.service.PaystackService;
import com.fixerhub.payment.service.ReceiptNotificationClient;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final PaymentRepository paymentRepository;
    private final PaystackService paystackService;
    private final ReceiptNotificationClient receiptNotificationClient;
    private final PaymentAccessGuard accessGuard;

    @GetMapping("/booking/{bookingId}")
    public ResponseEntity<PaymentResponse> getPaymentByBookingId(@PathVariable Long bookingId) {
        accessGuard.assertParticipantByBookingId(bookingId);
        return ResponseEntity.ok(paymentService.getPaymentByBookingId(bookingId));
    }

    /** M2: bounded lists — newest 50 by default, ?page=&size= (max 100) for more. */
    @GetMapping("/customer/{customerId}")
    public ResponseEntity<List<PaymentResponse>> getPaymentsByCustomer(
            @PathVariable Long customerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        accessGuard.assertIsCustomer(customerId);
        return ResponseEntity.ok(paymentService.getPaymentsByCustomer(customerId, page, size));
    }

    @GetMapping("/worker/{workerId}")
    public ResponseEntity<List<PaymentResponse>> getPaymentsByWorker(
            @PathVariable Long workerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        accessGuard.assertIsWorker(workerId);
        return ResponseEntity.ok(paymentService.getPaymentsByWorker(workerId, page, size));
    }

    @GetMapping("/worker/{workerId}/summary")
    public ResponseEntity<Map<String, Object>> getWorkerSummary(@PathVariable Long workerId) {
        accessGuard.assertIsWorker(workerId);
        return ResponseEntity.ok(paymentService.getWorkerPaymentSummary(workerId));
    }

    /** Internal endpoint for admin-service — no auth required. */
    @GetMapping("/internal/total-revenue")
    public ResponseEntity<Map<String, java.math.BigDecimal>> getTotalRevenue() {
        return ResponseEntity.ok(paymentService.getTotalRevenue());
    }

    /** Returns the Paystack checkout URL for a booking, creating the payment record on demand if needed. */
    @GetMapping("/booking/{bookingId}/pay-url")
    public ResponseEntity<Map<String, String>> getPayUrl(@PathVariable Long bookingId) {
        // SECURITY (C4): only the booking's customer may initiate payment.
        accessGuard.assertCustomerOfBooking(bookingId);
        return ResponseEntity.ok(paymentService.getOrCreatePayUrl(bookingId));
    }

    /** Customer calls this after completing Paystack checkout. The webhook
     *  usually settles first — this is the in-app fallback/confirmation. */
    @PostMapping("/booking/{bookingId}/verify")
    public ResponseEntity<Map<String, String>> verifyPayment(@PathVariable Long bookingId) {
        // SECURITY (C4): only the booking's customer may trigger verification/payout.
        accessGuard.assertCustomerOfBooking(bookingId);
        Payment payment = paymentRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new NotFoundException("Payment not found for booking " + bookingId
                        + ". Please tap 'Pay Now' first to open the payment page."));
        // Amount validation + idempotent settle + receipt + payout (shared with webhook)
        String status = paymentService.confirmAndSettle(payment);
        return ResponseEntity.ok(Map.of("status", status));
    }

    /** REFUND (ADMIN): full Paystack refund for a paid booking whose payout hasn't gone out. */
    @PostMapping("/booking/{bookingId}/refund")
    public ResponseEntity<Map<String, String>> refundPayment(@PathVariable Long bookingId) {
        return ResponseEntity.ok(paymentService.refundPayment(bookingId));
    }
}