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

    /**
     * WORKER NOTIFICATIONS: maps a worker PROFILE id to the userId that owns it,
     * so pushes can reach the worker's account. The mapping never changes, so it
     * is cached in memory. Returns null if unresolvable (push is then skipped).
     */
    @SuppressWarnings("unchecked")
    public Long userIdForWorker(Long workerId) {
        if (workerId == null) return null;
        Long cached = workerUserIdCache.get(workerId);
        if (cached != null) return cached;
        try {
            Map<String, Object> worker = restTemplate.getForObject(
                    "http://worker-service/workers/internal/" + workerId, Map.class);
            Object userId = worker != null ? worker.get("userId") : null;
            if (userId == null) return null;
            Long resolved = Long.valueOf(String.valueOf(userId));
            workerUserIdCache.put(workerId, resolved);
            return resolved;
        } catch (Exception e) {
            log.warn("Could not resolve worker {} to a userId: {}", workerId, e.getMessage());
            return null;
        }
    }

    private final java.util.concurrent.ConcurrentHashMap<Long, Long> workerUserIdCache =
            new java.util.concurrent.ConcurrentHashMap<>();

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
        pushToUser(push, userId, title, body, "SYSTEM", null);
    }

    /**
     * NOTIFICATION CENTER: every fan-out is also recorded in the user's in-app
     * inbox (auth-service), so history shows up even when FCM delivery isn't
     * possible (no token / Expo Go). Then the push is sent if a token exists.
     */
    public void pushToUser(PushNotificationService push, Long userId, String title, String body,
                           String type, Long bookingId) {
        recordInbox(userId, title, body, type, bookingId);
        String token = fcmTokenForUser(userId);
        // Pass type/bookingId through so a tapped push opens the same place the
        // in-app inbox entry does.
        if (token != null) push.sendPush(token, title, body, type, bookingId);
        else log.info("No FCM token for userId={} — push '{}' skipped (recorded in inbox)", userId, title);
    }

    /** Best-effort: failures never block the notification pipeline. */
    public void recordInbox(Long userId, String title, String body, String type, Long bookingId) {
        if (userId == null) return;
        try {
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("userId", userId);
            payload.put("title", title);
            payload.put("body", body);
            payload.put("type", type);
            if (bookingId != null) payload.put("bookingId", bookingId);
            restTemplate.postForEntity("http://auth-service/auth/internal/notifications", payload, Void.class);
        } catch (Exception e) {
            log.warn("Could not record inbox notification for userId={}: {}", userId, e.getMessage());
        }
    }
}
