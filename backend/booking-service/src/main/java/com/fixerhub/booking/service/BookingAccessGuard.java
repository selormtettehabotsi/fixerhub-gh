package com.fixerhub.booking.service;

import com.fixerhub.booking.config.AuthContext;
import com.fixerhub.booking.model.Booking;
import com.fixerhub.booking.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * SECURITY (C4): ownership checks — a caller may only touch bookings they are
 * a party to (customer or assigned worker). ADMIN bypasses all checks.
 */
@Component
@RequiredArgsConstructor
public class BookingAccessGuard {

    private final BookingRepository bookingRepository;
    private final WorkerClient workerClient;

    private Booking load(Long bookingId) {
        return bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
    }

    private static Long callerId() {
        Long id = AuthContext.userId();
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Missing user identity. Please log in again.");
        }
        return id;
    }

    private boolean callerIsWorkerOf(Booking booking) {
        Long workerUserId = workerClient.resolveWorkerUserId(booking.getWorkerId());
        return workerUserId != null && workerUserId.equals(AuthContext.userId());
    }

    /** Caller must be the booking's customer, its assigned worker, or an admin. */
    public void assertParticipant(Long bookingId) {
        if (AuthContext.isAdmin()) return;
        Booking booking = load(bookingId);
        Long caller = callerId();
        if (caller.equals(booking.getCustomerId()) || callerIsWorkerOf(booking)) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this booking");
    }

    /** Caller must be the booking's customer, or an admin. */
    public void assertCustomerOwns(Long bookingId) {
        if (AuthContext.isAdmin()) return;
        Booking booking = load(bookingId);
        if (callerId().equals(booking.getCustomerId())) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the booking's customer can do this");
    }

    /** Caller must be the booking's assigned worker, or an admin. */
    public void assertWorkerOwns(Long bookingId) {
        if (AuthContext.isAdmin()) return;
        Booking booking = load(bookingId);
        callerId();
        if (callerIsWorkerOf(booking)) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the booking's worker can do this");
    }

    /** Caller must be the given customer (by userId), or an admin. */
    public void assertIsCustomer(Long customerId) {
        if (AuthContext.isAdmin()) return;
        if (callerId().equals(customerId)) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only view your own bookings");
    }

    /** Caller must own the given worker profile, or be an admin. */
    public void assertIsWorker(Long workerId) {
        if (AuthContext.isAdmin()) return;
        Long workerUserId = workerClient.resolveWorkerUserId(workerId);
        if (workerUserId != null && workerUserId.equals(callerId())) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only view your own bookings");
    }
}
