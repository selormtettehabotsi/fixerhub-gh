package com.fixerhub.booking.controller;

import com.fixerhub.booking.config.AuthContext;
import com.fixerhub.booking.dto.BookingRequest;
import com.fixerhub.booking.dto.BookingResponse;
import com.fixerhub.booking.service.BookingAccessGuard;
import com.fixerhub.booking.service.BookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;
    private final BookingAccessGuard accessGuard;

    @PostMapping
    public ResponseEntity<BookingResponse> createBooking(@RequestBody BookingRequest request) {
        // SECURITY (C4): a customer can only create bookings as themselves.
        if (!AuthContext.isAdmin() && AuthContext.userId() != null) {
            request.setCustomerId(AuthContext.userId());
        }
        return ResponseEntity.status(201).body(bookingService.createBooking(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<BookingResponse> getBookingById(@PathVariable Long id) {
        accessGuard.assertParticipant(id);
        return ResponseEntity.ok(bookingService.getBookingById(id));
    }

    /** M2: bounded lists — newest 50 by default, ?page=&size= (max 100) for more. */
    @GetMapping("/customer/{customerId}")
    public ResponseEntity<List<BookingResponse>> getBookingsByCustomer(
            @PathVariable Long customerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        accessGuard.assertIsCustomer(customerId);
        return ResponseEntity.ok(bookingService.getBookingsByCustomer(customerId, page, size));
    }

    /** Returns bookings for a given worker (worker profile id), newest first. */
    @GetMapping("/worker/{workerId}")
    public ResponseEntity<List<BookingResponse>> getWorkerBookings(
            @PathVariable Long workerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        accessGuard.assertIsWorker(workerId);
        return ResponseEntity.ok(bookingService.getWorkerBookings(workerId, page, size));
    }

    /** MILESTONES: aggregate completed-jobs count for the public profile badge.
     *  Any authenticated user may read it — it's a count, not booking data. */
    @GetMapping("/worker/{workerId}/stats")
    public ResponseEntity<java.util.Map<String, Object>> workerStats(@PathVariable Long workerId) {
        return ResponseEntity.ok(java.util.Map.of(
                "completedJobs", bookingService.completedJobsCount(workerId)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<BookingResponse> updateBooking(@PathVariable Long id,
                                                         @RequestBody BookingRequest request) {
        accessGuard.assertCustomerOwns(id);
        return ResponseEntity.ok(bookingService.updateBooking(id, request));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<BookingResponse> updateStatus(@PathVariable Long id,
                                                        @RequestBody Map<String, String> body) {
        accessGuard.assertWorkerOwns(id);
        return ResponseEntity.ok(bookingService.updateStatus(id, body.get("status")));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<BookingResponse> cancelBooking(@PathVariable Long id) {
        accessGuard.assertCustomerOwns(id);
        return ResponseEntity.ok(bookingService.cancelBooking(id));
    }

    @PostMapping("/{id}/quote")
    public ResponseEntity<BookingResponse> submitQuote(
            @PathVariable Long id,
            @RequestBody Map<String, BigDecimal> body) {
        accessGuard.assertWorkerOwns(id);
        return ResponseEntity.ok(bookingService.submitQuote(id, body.get("quotedAmount")));
    }

    @PutMapping("/{id}/quote/accept")
    public ResponseEntity<BookingResponse> acceptQuote(@PathVariable Long id) {
        accessGuard.assertCustomerOwns(id);
        return ResponseEntity.ok(bookingService.acceptQuote(id));
    }

    @PutMapping("/{id}/quote/decline")
    public ResponseEntity<BookingResponse> declineQuote(@PathVariable Long id) {
        accessGuard.assertCustomerOwns(id);
        return ResponseEntity.ok(bookingService.declineQuote(id));
    }

    /** Internal endpoint for admin-service to fetch all bookings (not exposed via gateway). */
    @GetMapping("/internal/all")
    public ResponseEntity<List<BookingResponse>> getAllBookings(
            @RequestParam(required = false) Integer page,
            @RequestParam(defaultValue = "50") int size) {
        // M2: paged when ?page= is provided; full list otherwise (dashboard counts)
        return ResponseEntity.ok(page == null
                ? bookingService.getAllBookings()
                : bookingService.getBookingsPaged(page, size));
    }

    /** ADMIN CHARTS (internal): bookings created per day for the dashboard trend. */
    @GetMapping("/internal/stats/daily")
    public ResponseEntity<List<java.util.Map<String, Object>>> bookingsPerDay(
            @RequestParam(defaultValue = "14") int days) {
        return ResponseEntity.ok(bookingService.bookingsPerDay(days));
    }

    /** Internal endpoint for payment-service to fetch a booking (not exposed via gateway). */
    @GetMapping("/internal/{id}")
    public ResponseEntity<BookingResponse> getBookingInternal(@PathVariable Long id) {
        return ResponseEntity.ok(bookingService.getBookingById(id));
    }
}