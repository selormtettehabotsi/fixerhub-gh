package com.fixerhub.booking.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fixerhub.booking.dto.BookingRequest;
import com.fixerhub.booking.dto.BookingResponse;
import com.fixerhub.booking.exception.BadRequestException;
import com.fixerhub.booking.exception.NotFoundException;
import com.fixerhub.booking.kafka.BookingEventPublisher;
import com.fixerhub.booking.model.Booking;
import com.fixerhub.booking.repository.BookingRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** M4: booking status transitions and quote flow — where the money events originate. */
@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private BookingEventPublisher bookingEventPublisher;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private BookingService bookingService;

    private Booking existingBooking() {
        return Booking.builder()
                .id(3L)
                .customerId(1L)
                .workerId(2L)
                .serviceType("Plumbing")
                .customerPhone("+233241234567")
                .amount(new BigDecimal("150.00"))
                .status(Booking.Status.ACCEPTED)
                .build();
    }

    @Test
    void createBooking_defaultsToPending() {
        BookingRequest request = new BookingRequest();
        request.setCustomerId(1L);
        request.setWorkerId(2L);
        request.setServiceType("Plumbing");
        request.setAmount(new BigDecimal("100.00"));

        when(bookingRepository.save(any(Booking.class))).thenAnswer(i -> i.getArgument(0));

        BookingResponse response = bookingService.createBooking(request);

        assertEquals("PENDING", response.getStatus());
        assertEquals(1L, response.getCustomerId());
        assertEquals(new BigDecimal("100.00"), response.getAmount());
    }

    @Test
    void updateStatus_completed_publishesCompletedEvent() {
        Booking booking = existingBooking();
        booking.setStatus(Booking.Status.IN_PROGRESS);   // N7: only IN_PROGRESS may complete
        when(bookingRepository.findById(3L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(i -> i.getArgument(0));

        BookingResponse response = bookingService.updateStatus(3L, "COMPLETED");

        assertEquals("COMPLETED", response.getStatus());
        verify(bookingEventPublisher).publishStatusUpdate(3L, "COMPLETED", 2L);
        verify(bookingEventPublisher).publishBookingCompleted(
                eq(3L), eq(1L), eq("+233241234567"), eq(new BigDecimal("150.00")), eq(2L));
    }

    @Test
    void updateStatus_accepted_doesNotPublishCompletedEvent() {
        Booking booking = existingBooking();
        booking.setStatus(Booking.Status.PENDING);
        when(bookingRepository.findById(3L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(i -> i.getArgument(0));

        bookingService.updateStatus(3L, "ACCEPTED");

        verify(bookingEventPublisher).publishStatusUpdate(3L, "ACCEPTED", 2L);
        verify(bookingEventPublisher, never()).publishBookingCompleted(any(), any(), any(), any(), any());
    }

    @Test
    void updateBooking_nonPending_throwsBadRequest() {
        Booking booking = existingBooking(); // status ACCEPTED
        when(bookingRepository.findById(3L)).thenReturn(Optional.of(booking));

        assertThrows(BadRequestException.class,
                () -> bookingService.updateBooking(3L, new BookingRequest()));
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void acceptQuote_copiesQuotedAmountIntoAmount() {
        Booking booking = existingBooking();
        booking.setQuotedAmount(new BigDecimal("120.50"));
        when(bookingRepository.findById(3L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(i -> i.getArgument(0));

        BookingResponse response = bookingService.acceptQuote(3L);

        assertEquals("ACCEPTED", response.getQuoteStatus());
        assertEquals(new BigDecimal("120.50"), response.getAmount());
    }

    @Test
    void submitQuote_publishesQuoteEvent() {
        Booking booking = existingBooking();
        when(bookingRepository.findById(3L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(i -> i.getArgument(0));

        bookingService.submitQuote(3L, new BigDecimal("99.99"));

        verify(bookingEventPublisher).publishQuoteSubmitted(3L, 1L, new BigDecimal("99.99"));
    }

    @Test
    void getBookingById_missing_throwsNotFound() {
        when(bookingRepository.findById(99L)).thenReturn(Optional.empty());
        assertThrows(NotFoundException.class, () -> bookingService.getBookingById(99L));
    }

    // N7: the state machine rejects illegal transitions
    @Test
    void updateStatus_illegalTransition_throwsBadRequest() {
        Booking booking = existingBooking();
        booking.setStatus(Booking.Status.COMPLETED);
        when(bookingRepository.findById(3L)).thenReturn(Optional.of(booking));

        assertThrows(BadRequestException.class, () -> bookingService.updateStatus(3L, "PENDING"));
        assertThrows(BadRequestException.class, () -> bookingService.updateStatus(3L, "COMPLETED"));
        verify(bookingEventPublisher, never()).publishBookingCompleted(any(), any(), any(), any(), any());
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void updateStatus_unknownStatus_throwsBadRequest() {
        Booking booking = existingBooking();
        when(bookingRepository.findById(3L)).thenReturn(Optional.of(booking));
        assertThrows(BadRequestException.class, () -> bookingService.updateStatus(3L, "TELEPORTED"));
    }
}
