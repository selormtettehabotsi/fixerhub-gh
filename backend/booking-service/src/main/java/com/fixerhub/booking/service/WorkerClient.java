package com.fixerhub.booking.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * SECURITY (C4): resolves a worker profile id to its owning userId so
 * ownership checks can compare against the caller's X-User-Id.
 * The mapping is immutable, so it is cached in memory.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WorkerClient {

    private final RestTemplate loadBalancedRestTemplate;
    private final ConcurrentHashMap<Long, Long> workerUserIdCache = new ConcurrentHashMap<>();

    /** Returns the userId that owns the given worker profile, or null if unresolvable. */
    @SuppressWarnings("unchecked")
    public Long resolveWorkerUserId(Long workerId) {
        if (workerId == null) return null;
        return workerUserIdCache.computeIfAbsent(workerId, id -> {
            try {
                Map<String, Object> worker = loadBalancedRestTemplate.getForObject(
                        "http://worker-service/workers/internal/" + id, Map.class);
                Object userId = worker != null ? worker.get("userId") : null;
                return userId != null ? Long.valueOf(String.valueOf(userId)) : null;
            } catch (Exception e) {
                log.warn("Could not resolve worker {} to a userId: {}", id, e.getMessage());
                return null;
            }
        });
    }

    /**
     * KYC GATE: is this worker approved to take jobs?
     *
     * Hiding unapproved workers from search isn't enough on its own — workerId
     * is just a number in the request body, so without this check a client
     * could still create a booking against an unvetted worker by guessing or
     * by replaying an old id.
     *
     * NOT cached: unlike the userId mapping above, verification status changes
     * (an admin approves, or revokes on a decline), and a stale "approved" is
     * exactly the wrong thing to hold onto.
     *
     * Returns true when worker-service can't be reached, deliberately: a
     * discovery blip shouldn't stop customers booking. The visibility filter is
     * the primary control; this is defence in depth.
     */
    @SuppressWarnings("unchecked")
    public boolean isApproved(Long workerId) {
        if (workerId == null) return false;
        try {
            Map<String, Object> worker = loadBalancedRestTemplate.getForObject(
                    "http://worker-service/workers/internal/" + workerId, Map.class);
            if (worker == null) return false;
            return "APPROVED".equals(String.valueOf(worker.get("verificationStatus")));
        } catch (Exception e) {
            log.warn("Could not check verification for worker {} — allowing the booking: {}",
                    workerId, e.getMessage());
            return true;
        }
    }
}
