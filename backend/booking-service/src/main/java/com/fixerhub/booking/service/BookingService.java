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

    private final BookingRepository bookingRepository;
    private final BookingEventPublisher eventPublisher;

    public BookingResponse createBooking(BookingRequest request) {
        Booking booking = Booking.builder()
                .customerId(request.getCustomerId())
                .workerId(request.getWorkerId())
                .serviceType(request.getServiceType())
                .scheduledAt(request.getScheduledAt())
                .build();
        return toResponse(bookingRepository.save(booking));
    }

    public BookingResponse getBookingById(Long id) {
        return toResponse(bookingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Booking not found")));
    }

    public BookingResponse updateStatus(Long id, Booking.Status status) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        booking.setStatus(status);
        Booking saved = bookingRepository.save(booking);
        if (status == Booking.Status.COMPLETED) {
            eventPublisher.publishBookingCompleted(saved.getId());
        }
        return toResponse(saved);
    }

    public List<BookingResponse> getCustomerBookings(Long customerId) {
        return bookingRepository.findByCustomerId(customerId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private BookingResponse toResponse(Booking b) {
        return BookingResponse.builder()
                .id(b.getId())
                .customerId(b.getCustomerId())
                .workerId(b.getWorkerId())
                .serviceType(b.getServiceType())
                .status(b.getStatus())
                .scheduledAt(b.getScheduledAt())
                .createdAt(b.getCreatedAt())
                .build();
    }
}
