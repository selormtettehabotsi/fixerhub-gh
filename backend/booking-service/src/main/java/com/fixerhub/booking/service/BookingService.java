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
                .notes(request.getNotes())
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
            bookingEventPublisher.publishBookingCompleted(saved.getId());
        }

        return toResponse(saved);
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
                .notes(booking.getNotes())
                .createdAt(booking.getCreatedAt())
                .build();
    }
}