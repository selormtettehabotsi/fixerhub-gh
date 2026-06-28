package com.fixerhub.booking.service;

import com.fixerhub.booking.dto.BookingRequest;
import com.fixerhub.booking.dto.BookingResponse;
import com.fixerhub.booking.kafka.BookingEventPublisher;
import com.fixerhub.booking.model.Booking;
import com.fixerhub.booking.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository      bookingRepository;
    private final BookingEventPublisher  bookingEventPublisher;

    // ------------------------------------------------------------------ //
    //  CREATE
    // ------------------------------------------------------------------ //
    public BookingResponse createBooking(BookingRequest request) {
        Booking booking = Booking.builder()
                .customerId(request.getCustomerId())
                .workerId(request.getWorkerId())
                .serviceType(request.getServiceType())
                .amount(request.getAmount())
                .minAmount(request.getMinAmount())
                .maxAmount(request.getMaxAmount())
                .notes(request.getNotes())
                .customerPhone(request.getCustomerPhone())
                .bookingImage(request.getBookingImage())
                .status(Booking.Status.PENDING)
                .build();
        return toResponse(bookingRepository.save(booking));
    }

    // ------------------------------------------------------------------ //
    //  READ
    // ------------------------------------------------------------------ //
    public BookingResponse getBookingById(Long id) {
        return toResponse(findOrThrow(id));
    }

    public List<BookingResponse> getBookingsByCustomer(Long customerId) {
        return bookingRepository.findByCustomerId(customerId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<BookingResponse> getAllBookings() {
        return bookingRepository.findAll()
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    /** Returns all bookings assigned to the given worker. */
    public List<BookingResponse> getWorkerBookings(Long workerId) {
        return bookingRepository.findByWorkerId(workerId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ------------------------------------------------------------------ //
    //  UPDATE
    // ------------------------------------------------------------------ //
    public BookingResponse updateStatus(Long id, String status) {
        Booking booking = findOrThrow(id);
        booking.setStatus(Booking.Status.valueOf(status.toUpperCase()));
        Booking saved = bookingRepository.save(booking);

        if (saved.getStatus() == Booking.Status.COMPLETED) {
            bookingEventPublisher.publishBookingCompleted(
                    saved.getId(), saved.getCustomerId(), saved.getCustomerPhone(), saved.getAmount(), saved.getWorkerId());
        }

        return toResponse(saved);
    }

    public BookingResponse updateBooking(Long id, BookingRequest request) {
        Booking booking = findOrThrow(id);
        if (booking.getStatus() != Booking.Status.PENDING) {
            throw new RuntimeException("Only PENDING bookings can be edited");
        }
        if (request.getServiceType() != null) booking.setServiceType(request.getServiceType());
        if (request.getAmount() != null) booking.setAmount(request.getAmount());
        if (request.getMinAmount() != null) booking.setMinAmount(request.getMinAmount());
        if (request.getMaxAmount() != null) booking.setMaxAmount(request.getMaxAmount());
        if (request.getNotes() != null) booking.setNotes(request.getNotes());
        if (request.getCustomerPhone() != null) booking.setCustomerPhone(request.getCustomerPhone());
        if (request.getBookingImage() != null) booking.setBookingImage(request.getBookingImage());
        return toResponse(bookingRepository.save(booking));
    }

    public BookingResponse cancelBooking(Long id) {
        Booking booking = findOrThrow(id);
        booking.setStatus(Booking.Status.CANCELLED);
        return toResponse(bookingRepository.save(booking));
    }

    // ------------------------------------------------------------------ //
    //  HELPERS
    // ------------------------------------------------------------------ //
    private Booking findOrThrow(Long id) {
        return bookingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Booking not found with id: " + id));
    }

    private BookingResponse toResponse(Booking booking) {
        return BookingResponse.builder()
                .id(booking.getId())
                .customerId(booking.getCustomerId())
                .workerId(booking.getWorkerId())
                .serviceType(booking.getServiceType())
                .status(booking.getStatus().name())
                .amount(booking.getAmount())
                .minAmount(booking.getMinAmount())
                .maxAmount(booking.getMaxAmount())
                .notes(booking.getNotes())
                .customerPhone(booking.getCustomerPhone())
                .bookingImage(booking.getBookingImage())
                .createdAt(booking.getCreatedAt())
                .build();
    }
}