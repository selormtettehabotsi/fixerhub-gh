package com.fixerhub.booking.service;

import com.fixerhub.booking.dto.BookingRequest;
import com.fixerhub.booking.dto.BookingResponse;
import com.fixerhub.booking.exception.BadRequestException;
import com.fixerhub.booking.exception.NotFoundException;
import com.fixerhub.booking.kafka.BookingEventPublisher;
import com.fixerhub.booking.model.Booking;
import com.fixerhub.booking.repository.BookingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository      bookingRepository;
    private final BookingEventPublisher  bookingEventPublisher;
    // M5: Spring-managed ObjectMapper (injected) instead of new-ing one per service
    private final ObjectMapper           objectMapper;

    public BookingResponse createBooking(BookingRequest request) {
        Booking booking = Booking.builder()
                .customerId(request.getCustomerId())
                .workerId(request.getWorkerId())
                .workerName(request.getWorkerName())
                .serviceType(request.getServiceType())
                .amount(request.getAmount())
                .minAmount(request.getMinAmount())
                .maxAmount(request.getMaxAmount())
                .notes(request.getNotes())
                .customerPhone(request.getCustomerPhone())
                .customerLat(request.getCustomerLat())
                .customerLng(request.getCustomerLng())
                .bookingImage(request.getBookingImage())
                .bookingImages(toJson(request.getBookingImages()))
                .pricingStyle(request.getPricingStyle())
                .recurrence(request.getRecurrence())
                .status(Booking.Status.PENDING)
                .build();
        return toResponse(bookingRepository.save(booking));
    }

    public BookingResponse getBookingById(Long id) {
        return toResponse(findOrThrow(id));
    }

    /** M2: bounded page (newest first) — caps DB load regardless of history size. */
    public List<BookingResponse> getBookingsByCustomer(Long customerId, int page, int size) {
        return bookingRepository.findByCustomerIdOrderByIdDesc(customerId, pageOf(page, size))
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    private static org.springframework.data.domain.Pageable pageOf(int page, int size) {
        return org.springframework.data.domain.PageRequest.of(
                Math.max(0, page), Math.min(Math.max(1, size), 100));
    }

    public List<BookingResponse> getAllBookings() {
        return bookingRepository.findAll()
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    /** MILESTONES: completed-jobs count for the public profile badge. */
    public long completedJobsCount(Long workerId) {
        return bookingRepository.countByWorkerIdAndStatus(workerId, Booking.Status.COMPLETED);
    }

    public List<BookingResponse> getWorkerBookings(Long workerId, int page, int size) {
        return bookingRepository.findByWorkerIdOrderByIdDesc(workerId, pageOf(page, size))
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    // STATE MACHINE (N7): the only legal status transitions. Anything else
    // (COMPLETED→PENDING, double-COMPLETED re-firing payment events, resurrecting
    // a cancelled job, …) is rejected with a 400.
    private static final Map<Booking.Status, Set<Booking.Status>> ALLOWED_TRANSITIONS = Map.of(
            Booking.Status.PENDING,           EnumSet.of(Booking.Status.ACCEPTED, Booking.Status.CANCELLED),
            Booking.Status.ACCEPTED,          EnumSet.of(Booking.Status.WORKER_ON_THE_WAY, Booking.Status.IN_PROGRESS, Booking.Status.CANCELLED),
            Booking.Status.WORKER_ON_THE_WAY, EnumSet.of(Booking.Status.IN_PROGRESS, Booking.Status.CANCELLED),
            Booking.Status.IN_PROGRESS,       EnumSet.of(Booking.Status.COMPLETED, Booking.Status.CANCELLED),
            Booking.Status.COMPLETED,         EnumSet.noneOf(Booking.Status.class),
            Booking.Status.CANCELLED,         EnumSet.noneOf(Booking.Status.class)
    );

    private static void assertTransition(Booking.Status from, Booking.Status to) {
        if (!ALLOWED_TRANSITIONS.getOrDefault(from, EnumSet.noneOf(Booking.Status.class)).contains(to)) {
            throw new BadRequestException("Cannot change booking status from " + from + " to " + to);
        }
    }

    public BookingResponse updateStatus(Long id, String status) {
        Booking booking = findOrThrow(id);
        Booking.Status newStatus;
        try {
            newStatus = Booking.Status.valueOf(status == null ? "" : status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown booking status: " + status);
        }
        assertTransition(booking.getStatus(), newStatus);   // N7
        booking.setStatus(newStatus);
        Booking saved = bookingRepository.save(booking);

        // Publish status update for all status changes
        bookingEventPublisher.publishStatusUpdate(saved.getId(), saved.getStatus().name(), saved.getWorkerId());

        if (saved.getStatus() == Booking.Status.COMPLETED) {
            bookingEventPublisher.publishBookingCompleted(
                    saved.getId(), saved.getCustomerId(), saved.getCustomerPhone(), saved.getAmount(), saved.getWorkerId());
            spawnNextRecurring(saved); // RETENTION: recurring bookings
        }

        return toResponse(saved);
    }

    /**
     * RETENTION: completing a recurring booking auto-creates the next visit
     * (same worker, service and details) scheduled one interval ahead.
     */
    private void spawnNextRecurring(Booking done) {
        String rec = done.getRecurrence();
        if (rec == null || rec.isBlank() || "NONE".equalsIgnoreCase(rec)) return;
        int days = switch (rec.toUpperCase()) {
            case "WEEKLY"   -> 7;
            case "BIWEEKLY" -> 14;
            case "MONTHLY"  -> 30;
            default         -> 0;
        };
        if (days == 0) return;
        Booking next = Booking.builder()
                .customerId(done.getCustomerId())
                .workerId(done.getWorkerId())
                .workerName(done.getWorkerName())
                .serviceType(done.getServiceType())
                .amount(done.getAmount())
                .minAmount(done.getMinAmount())
                .maxAmount(done.getMaxAmount())
                .notes(done.getNotes())
                .customerPhone(done.getCustomerPhone())
                .customerLat(done.getCustomerLat())
                .customerLng(done.getCustomerLng())
                .pricingStyle(done.getPricingStyle())
                .recurrence(rec)
                .scheduledAt(java.time.LocalDateTime.now().plusDays(days))
                .status(Booking.Status.PENDING)
                .build();
        bookingRepository.save(next);
    }

    public BookingResponse updateBooking(Long id, BookingRequest request) {
        Booking booking = findOrThrow(id);
        if (booking.getStatus() != Booking.Status.PENDING) {
            throw new BadRequestException("Only PENDING bookings can be edited");
        }
        if (request.getWorkerName() != null) booking.setWorkerName(request.getWorkerName());
        if (request.getServiceType() != null) booking.setServiceType(request.getServiceType());
        if (request.getAmount() != null) booking.setAmount(request.getAmount());
        if (request.getMinAmount() != null) booking.setMinAmount(request.getMinAmount());
        if (request.getMaxAmount() != null) booking.setMaxAmount(request.getMaxAmount());
        if (request.getNotes() != null) booking.setNotes(request.getNotes());
        if (request.getCustomerPhone() != null) booking.setCustomerPhone(request.getCustomerPhone());
        if (request.getBookingImage() != null) booking.setBookingImage(request.getBookingImage());
        if (request.getBookingImages() != null) booking.setBookingImages(toJson(request.getBookingImages()));
        return toResponse(bookingRepository.save(booking));
    }

    public BookingResponse cancelBooking(Long id) {
        Booking booking = findOrThrow(id);
        assertTransition(booking.getStatus(), Booking.Status.CANCELLED);   // N7
        booking.setStatus(Booking.Status.CANCELLED);
        return toResponse(bookingRepository.save(booking));
    }

    public BookingResponse submitQuote(Long id, BigDecimal quotedAmount) {
        Booking booking = findOrThrow(id);
        booking.setQuotedAmount(quotedAmount);
        booking.setQuoteStatus(Booking.QuoteStatus.PENDING);
        Booking saved = bookingRepository.save(booking);
        bookingEventPublisher.publishQuoteSubmitted(saved.getId(), saved.getCustomerId(), quotedAmount);
        return toResponse(saved);
    }

    public BookingResponse acceptQuote(Long id) {
        Booking booking = findOrThrow(id);
        booking.setQuoteStatus(Booking.QuoteStatus.ACCEPTED);
        if (booking.getQuotedAmount() != null) {
            booking.setAmount(booking.getQuotedAmount());
        }
        return toResponse(bookingRepository.save(booking));
    }

    public BookingResponse declineQuote(Long id) {
        Booking booking = findOrThrow(id);
        booking.setQuoteStatus(Booking.QuoteStatus.DECLINED);
        return toResponse(bookingRepository.save(booking));
    }

    private String toJson(List<String> list) {
        if (list == null || list.isEmpty()) return null;
        try { return objectMapper.writeValueAsString(list); } catch (Exception e) { return null; }
    }

    private List<String> fromJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        try { return objectMapper.readValue(json, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}); }
        catch (Exception e) { return List.of(); }
    }

    private Booking findOrThrow(Long id) {
        return bookingRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Booking not found with id: " + id));
    }

    private BookingResponse toResponse(Booking booking) {
        return BookingResponse.builder()
                .id(booking.getId())
                .customerId(booking.getCustomerId())
                .workerId(booking.getWorkerId())
                .workerName(booking.getWorkerName())
                .serviceType(booking.getServiceType())
                .status(booking.getStatus().name())
                .amount(booking.getAmount())
                .minAmount(booking.getMinAmount())
                .maxAmount(booking.getMaxAmount())
                .notes(booking.getNotes())
                .customerPhone(booking.getCustomerPhone())
                .customerLat(booking.getCustomerLat())
                .customerLng(booking.getCustomerLng())
                .bookingImage(booking.getBookingImage())
                .bookingImages(fromJson(booking.getBookingImages()))
                .createdAt(booking.getCreatedAt())
                .quotedAmount(booking.getQuotedAmount())
                .quoteStatus(booking.getQuoteStatus() != null ? booking.getQuoteStatus().name() : null)
                .pricingStyle(booking.getPricingStyle())
                .recurrence(booking.getRecurrence())
                .build();
    }
}
