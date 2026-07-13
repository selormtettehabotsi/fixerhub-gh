package com.fixerhub.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * PUSH: resolves the data booking events don't carry — the customer's userId
 * for a booking, and a user's FCM device token. All lookups are best-effort:
 * a failure means "no push", never a crashed consumer.
 */
@Slf4j
@Service
public class LookupClient {

    private final RestTemplate restTemplate;

    public LookupClient(@Qualifier("loadBalancedRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /** FCM token for a user, or null when none registered / lookup fails. */
    @SuppressWarnings("unchecked")
    public String fcmTokenForUser(Long userId) {
        if (userId == null) return null;
        try {
            Map<String, String> resp = restTemplate.getForObject(
                    "http://auth-service/auth/internal/users/" + userId + "/fcm-token", Map.class);
            String token = resp != null ? resp.get("token") : null;
            return (token == null || token.isBlank()) ? null : token;
        } catch (Exception e) {
            log.warn("Could not fetch FCM token for userId={}: {}", userId, e.getMessage());
            return null;
        }
    }

    /** The customer userId on a booking, or null. */
    @SuppressWarnings("unchecked")
    public Long customerIdForBooking(Long bookingId) {
        if (bookingId == null) return null;
        try {
            Map<String, Object> booking = restTemplate.getForObject(
                    "http://booking-service/bookings/internal/" + bookingId, Map.class);
            Object customerId = booking != null ? booking.get("customerId") : null;
            return customerId != null ? Long.valueOf(String.valueOf(customerId)) : null;
        } catch (Exception e) {
            log.warn("Could not fetch booking {}: {}", bookingId, e.getMessage());
            return null;
        }
    }

    /** Convenience: push to a user by id if they have a registered token. */
    public void pushToUser(PushNotificationService push, Long userId, String title, String body) {
        String token = fcmTokenForUser(userId);
        if (token != null) push.sendPush(token, title, body);
        else log.info("No FCM token for userId={} — push '{}' skipped", userId, title);
    }
}
