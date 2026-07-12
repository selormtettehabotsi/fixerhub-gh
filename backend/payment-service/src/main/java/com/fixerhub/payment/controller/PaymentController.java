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

    /** Customer calls this after completing Paystack checkout. */
    @PostMapping("/booking/{bookingId}/verify")
    public ResponseEntity<Map<String, String>> verifyPayment(@PathVariable Long bookingId) {
        // SECURITY (C4): only the booking's customer may trigger verification/payout.
        accessGuard.assertCustomerOfBooking(bookingId);
        Payment payment = paymentRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new NotFoundException("Payment not found for booking " + bookingId
                        + ". Please tap 'Pay Now' first to open the payment page."));

        // IDEMPOTENCY (H3): a replayed verify on an already-successful payment
        // must not re-send receipts or re-initiate the worker payout.
        if (payment.getStatus() == PaymentStatus.SUCCESS) {
            return ResponseEntity.ok(Map.of("status", "success"));
        }

        String status = paystackService.verifyPayment(payment.getPaystackReference());
        if ("success".equals(status)) {
            // RACE GUARD (N10): claim SUCCESS atomically — only the single caller
            // that flips the row sends the receipt and initiates the payout.
            int claimed = paymentRepository.claimSuccess(payment.getId(), PaymentStatus.SUCCESS);
            if (claimed == 0) {
                return ResponseEntity.ok(Map.of("status", "success"));
            }
            payment.setStatus(PaymentStatus.SUCCESS);
            payment.setPaystackStatus("success");
            // Trigger payment receipt notification (SMS + push)
            receiptNotificationClient.sendPaymentReceipt(payment);
            // Initiate automated worker payout via Paystack Transfer
            // (initiateWorkerPayout enforces the payout state machine — H3)
            paymentService.initiateWorkerPayout(payment);
        } else {
            payment.setPaystackStatus(status);
            payment.setStatus(PaymentStatus.FAILED);
            paymentRepository.save(payment);
        }
        return ResponseEntity.ok(Map.of("status", status));
    }
}