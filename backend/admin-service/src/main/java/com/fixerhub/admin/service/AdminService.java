package com.fixerhub.admin.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final RestTemplate restTemplate;

    public List<Map<String, Object>> getAllUsers() {
        log.info("Fetching all users from auth-service");
        try {
            List<Map<String, Object>> users = restTemplate.exchange(
                    "http://auth-service/auth/internal/users",
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            ).getBody();
            return users != null ? users : List.of();
        } catch (Exception e) {
            log.error("Failed to fetch users from auth-service: {}", e.getMessage());
            return List.of(Map.of("error", "Could not reach auth-service"));
        }
    }

    public List<Map<String, Object>> getAllBookings() {
        log.info("Fetching all bookings from booking-service");
        try {
            List<Map<String, Object>> bookings = restTemplate.exchange(
                    "http://booking-service/bookings/internal/all",
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            ).getBody();
            return bookings != null ? bookings : List.of();
        } catch (Exception e) {
            log.error("Failed to fetch bookings from booking-service: {}", e.getMessage());
            return List.of(Map.of("error", "Could not reach booking-service"));
        }
    }

    public Map<String, BigDecimal> getRevenueStats() {
        log.info("Fetching revenue stats from payment-service");
        try {
            Map<String, BigDecimal> result = restTemplate.exchange(
                    "http://payment-service/payments/internal/total-revenue",
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<Map<String, BigDecimal>>() {}
            ).getBody();
            return result != null ? result
                    : Map.of("totalRevenue", BigDecimal.ZERO, "totalCommission", BigDecimal.ZERO, "totalWorkerPayouts", BigDecimal.ZERO);
        } catch (Exception e) {
            log.error("Failed to fetch revenue from payment-service: {}", e.getMessage());
            return Map.of("totalRevenue", BigDecimal.ZERO, "totalCommission", BigDecimal.ZERO, "totalWorkerPayouts", BigDecimal.ZERO);
        }
    }

    public List<Map<String, Object>> getAllWorkers() {
        log.info("Fetching all workers from worker-service");
        try {
            List<Map<String, Object>> workers = restTemplate.exchange(
                    "http://worker-service/workers/internal/all",
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            ).getBody();
            return workers != null ? workers : List.of();
        } catch (Exception e) {
            log.error("Failed to fetch workers from worker-service: {}", e.getMessage());
            return List.of(Map.of("error", "Could not reach worker-service"));
        }
    }

    public Map<String, Object> verifyWorker(Long workerId) {
        log.info("Verifying worker {} via worker-service", workerId);
        try {
            return restTemplate.exchange(
                    "http://worker-service/workers/" + workerId + "/verify",
                    HttpMethod.PUT,
                    null,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            ).getBody();
        } catch (Exception e) {
            log.error("Failed to verify worker {}: {}", workerId, e.getMessage());
            return Map.of("error", e.getMessage());
        }
    }

    public Map<String, Object> unverifyWorker(Long workerId) {
        log.info("Unverifying worker {} via worker-service", workerId);
        try {
            return restTemplate.exchange(
                    "http://worker-service/workers/" + workerId + "/unverify",
                    HttpMethod.PUT,
                    null,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            ).getBody();
        } catch (Exception e) {
            log.error("Failed to unverify worker {}: {}", workerId, e.getMessage());
            return Map.of("error", e.getMessage());
        }
    }

    // ─── KYC Verification Proxies ─────────────────────────────────────────────

    public List<Map<String, Object>> getPendingVerifications() {
        log.info("Fetching pending KYC verifications from worker-service");
        try {
            List<Map<String, Object>> result = restTemplate.exchange(
                    "http://worker-service/workers/internal/verification/pending",
                    HttpMethod.GET, null,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            ).getBody();
            return result != null ? result : List.of();
        } catch (Exception e) {
            log.error("Failed to fetch pending verifications: {}", e.getMessage());
            return List.of(Map.of("error", e.getMessage()));
        }
    }

    public Map<String, Object> approveVerification(Long workerId) {
        log.info("Approving KYC for worker {}", workerId);
        try {
            // Use /internal/ path — bypasses worker-service JWT requirement for trusted service calls
            Map<String, Object> result = restTemplate.exchange(
                    "http://worker-service/workers/internal/" + workerId + "/verification/approve",
                    HttpMethod.PUT, null,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            ).getBody();
            return result != null ? result : Map.of();
        } catch (Exception e) {
            log.error("Failed to approve verification for worker {}: {}", workerId, e.getMessage());
            // Rethrow so GlobalExceptionHandler returns a proper HTTP error to the frontend.
            // Without this, the frontend sees HTTP 200 and removes the card even though
            // the worker-service was never updated — causing the worker to reappear on refresh.
            throw new RuntimeException("Could not approve verification: " + e.getMessage());
        }
    }

    public Map<String, Object> declineVerification(Long workerId, Map<String, String> body) {
        log.info("Declining KYC for worker {}", workerId);
        try {
            Map<String, Object> result = restTemplate.exchange(
                    "http://worker-service/workers/internal/" + workerId + "/verification/decline",
                    HttpMethod.PUT, new HttpEntity<>(body),
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            ).getBody();
            return result != null ? result : Map.of();
        } catch (Exception e) {
            log.error("Failed to decline verification for worker {}: {}", workerId, e.getMessage());
            throw new RuntimeException("Could not decline verification: " + e.getMessage());
        }
    }

    public Map<String, Object> requestResubmit(Long workerId, Map<String, String> body) {
        log.info("Requesting resubmission for worker {}", workerId);
        try {
            Map<String, Object> result = restTemplate.exchange(
                    "http://worker-service/workers/internal/" + workerId + "/verification/request-resubmit",
                    HttpMethod.PUT, new HttpEntity<>(body),
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            ).getBody();
            return result != null ? result : Map.of();
        } catch (Exception e) {
            log.error("Failed to request resubmission for worker {}: {}", workerId, e.getMessage());
            throw new RuntimeException("Could not request resubmission: " + e.getMessage());
        }
    }

    public Map<String, Object> getDashboardStats() {
        log.info("Fetching dashboard stats");
        int totalUsers = 0;
        int totalBookings = 0;
        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal totalCommission = BigDecimal.ZERO;
        BigDecimal totalWorkerPayouts = BigDecimal.ZERO;

        try {
            List<Map<String, Object>> users = getAllUsers();
            totalUsers = (int) users.stream()
                    .filter(u -> !u.containsKey("error")).count();
        } catch (Exception e) {
            log.warn("Could not get user count: {}", e.getMessage());
        }

        try {
            List<Map<String, Object>> bookings = getAllBookings();
            totalBookings = (int) bookings.stream()
                    .filter(b -> !b.containsKey("error")).count();
        } catch (Exception e) {
            log.warn("Could not get booking count: {}", e.getMessage());
        }

        try {
            Map<String, BigDecimal> revenueStats = getRevenueStats();
            totalRevenue       = revenueStats.getOrDefault("totalRevenue", BigDecimal.ZERO);
            totalCommission    = revenueStats.getOrDefault("totalCommission", BigDecimal.ZERO);
            totalWorkerPayouts = revenueStats.getOrDefault("totalWorkerPayouts", BigDecimal.ZERO);
        } catch (Exception e) {
            log.warn("Could not get revenue stats: {}", e.getMessage());
        }

        int activeWorkers = 0;
        try {
            Map<String, Integer> workerStats = restTemplate.exchange(
                    "http://worker-service/workers/internal/active-count",
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<Map<String, Integer>>() {}
            ).getBody();
            activeWorkers = workerStats != null ? workerStats.getOrDefault("activeWorkers", 0) : 0;
        } catch (Exception e) {
            log.warn("Could not get active worker count: {}", e.getMessage());
        }

        return Map.of(
                "totalUsers", totalUsers,
                "totalBookings", totalBookings,
                "totalRevenue", totalRevenue,
                "totalCommission", totalCommission,
                "totalWorkerPayouts", totalWorkerPayouts,
                "activeWorkers", activeWorkers
        );
    }
}
