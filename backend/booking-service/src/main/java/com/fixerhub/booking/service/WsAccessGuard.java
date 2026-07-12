package com.fixerhub.booking.service;

import com.fixerhub.booking.model.Booking;
import com.fixerhub.booking.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * SECURITY (N1): participant checks for WebSocket destinations.
 * Conversation ids look like "c{customerUserId}_w{workerProfileId}".
 */
@Component
@RequiredArgsConstructor
public class WsAccessGuard {

    private static final Pattern CONV_ID = Pattern.compile("^c(\\d+)_w(\\d+)$");

    private final BookingRepository bookingRepository;
    private final WorkerClient workerClient;

    private static boolean isAdmin(String role) {
        return "ADMIN".equals(role);
    }

    /** May this user read/write the given customer↔worker conversation? */
    public boolean canAccessConversation(Long userId, String role, String conversationId) {
        if (userId == null || conversationId == null) return false;
        if (isAdmin(role)) return true;
        Matcher m = CONV_ID.matcher(conversationId);
        if (!m.matches()) return false;
        long customerUserId = Long.parseLong(m.group(1));
        long workerProfileId = Long.parseLong(m.group(2));
        if (userId == customerUserId) return true;
        Long workerUserId = workerClient.resolveWorkerUserId(workerProfileId);
        return workerUserId != null && workerUserId.equals(userId);
    }

    /** May this user access booking-scoped topics (legacy chat, live location)? */
    public boolean isBookingParticipant(Long userId, String role, Long bookingId) {
        if (userId == null || bookingId == null) return false;
        if (isAdmin(role)) return true;
        Booking booking = bookingRepository.findById(bookingId).orElse(null);
        if (booking == null) return false;
        if (userId.equals(booking.getCustomerId())) return true;
        Long workerUserId = workerClient.resolveWorkerUserId(booking.getWorkerId());
        return workerUserId != null && workerUserId.equals(userId);
    }

    /** May this user publish live location for this booking? Only the assigned
     *  worker, and only while the booking is actually en route. */
    public boolean canPublishLocation(Long userId, Long bookingId) {
        if (userId == null || bookingId == null) return false;
        Booking booking = bookingRepository.findById(bookingId).orElse(null);
        if (booking == null || booking.getStatus() != Booking.Status.WORKER_ON_THE_WAY) return false;
        Long workerUserId = workerClient.resolveWorkerUserId(booking.getWorkerId());
        return workerUserId != null && workerUserId.equals(userId);
    }
}
