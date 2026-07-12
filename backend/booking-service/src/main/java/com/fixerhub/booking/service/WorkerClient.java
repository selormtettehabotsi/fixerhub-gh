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
}
