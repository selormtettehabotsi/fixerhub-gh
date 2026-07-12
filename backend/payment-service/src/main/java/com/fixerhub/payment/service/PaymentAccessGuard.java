package com.fixerhub.payment.service;

import com.fixerhub.payment.config.AuthContext;
import com.fixerhub.payment.model.Payment;
import com.fixerhub.payment.repository.PaymentRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * SECURITY (C4): ownership checks for payment endpoints — callers may only
 * read or act on payments for bookings they are a party to. ADMIN bypasses.
 */
@Slf4j
@Component
public class PaymentAccessGuard {

    private final PaymentRepository paymentRepository;
    private final RestTemplate loadBalancedRestTemplate;
    private final ConcurrentHashMap<Long, Long> workerUserIdCache = new ConcurrentHashMap<>();

    public PaymentAccessGuard(PaymentRepository paymentRepository,
                              @Qualifier("loadBalancedRestTemplate") RestTemplate loadBalancedRestTemplate) {
        this.paymentRepository = paymentRepository;
        this.loadBalancedRestTemplate = loadBalancedRestTemplate;
    }

    private static Long callerId() {
        Long id = AuthContext.userId();
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Missing user identity. Please log in again.");
        }
        return id;
    }

    @SuppressWarnings("unchecked")
    private Long resolveWorkerUserId(Long workerId) {
        if (workerId == null) return null;
        return workerUserIdCache.computeIfAbsent(workerId, id -> {
            try {
                Map<String, Object> worker = loadBalancedRestTemplate.getForObject(
                        "http://worker-service/workers/internal/" + id, Map.class);
                Object userId = worker != null ? worker.get("userId") : null;
                return userId != null ? Long.valueOf(String.valueOf(userId)) : null;
            } catch (Exception e) {
                log.warn("Could not resolve worker {} to a userId: {}", id, e.getMessage());
                return null;
            }
        });
    }

    @SuppressWarnings("unchecked")
    private Long fetchBookingCustomerId(Long bookingId) {
        try {
            Map<String, Object> booking = loadBalancedRestTemplate.getForObject(
                    "http://booking-service/bookings/internal/" + bookingId, Map.class);
            Object customerId = booking != null ? booking.get("customerId") : null;
            return customerId != null ? Long.valueOf(String.valueOf(customerId)) : null;
        } catch (Exception e) {
            log.warn("Could not fetch booking {}: {}", bookingId, e.getMessage());
            return null;
        }
    }

    /** Caller must be the paying customer of the booking (payment record or booking lookup), or admin. */
    public void assertCustomerOfBooking(Long bookingId) {
        if (AuthContext.isAdmin()) return;
        Long caller = callerId();

        Optional<Payment> payment = paymentRepository.findByBookingId(bookingId);
        Long customerId = payment.map(Payment::getCustomerId)
                .orElseGet(() -> fetchBookingCustomerId(bookingId));

        if (customerId != null && customerId.equals(caller)) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Only the booking's customer can perform this payment action");
    }

    /** Caller must be the customer or the assigned worker of the payment's booking, or admin. */
    public void assertParticipantByBookingId(Long bookingId) {
        if (AuthContext.isAdmin()) return;
        Long caller = callerId();
        Payment payment = paymentRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Payment not found for booking " + bookingId));
        if (caller.equals(payment.getCustomerId())) return;
        Long workerUserId = resolveWorkerUserId(payment.getWorkerId());
        if (workerUserId != null && workerUserId.equals(caller)) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this payment");
    }

    /** Caller must be the given customer (userId), or admin. */
    public void assertIsCustomer(Long customerId) {
        if (AuthContext.isAdmin()) return;
        if (callerId().equals(customerId)) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only view your own payments");
    }

    /** Caller must own the given worker profile, or be admin. */
    public void assertIsWorker(Long workerId) {
        if (AuthContext.isAdmin()) return;
        Long workerUserId = resolveWorkerUserId(workerId);
        if (workerUserId != null && workerUserId.equals(callerId())) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only view your own payments");
    }
}
