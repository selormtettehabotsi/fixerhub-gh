package com.fixerhub.admin.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class AdminService {

    /**
     * In production, these methods would call other microservices
     * via Feign clients or RestTemplate to aggregate data.
     */

    public List<Map<String, Object>> getAllUsers() {
        log.info("Fetching all users (stub)");
        // TODO: Call auth-service via Feign client
        return List.of(Map.of("message", "Connect to auth-service to get real data"));
    }

    public List<Map<String, Object>> getAllBookings() {
        log.info("Fetching all bookings (stub)");
        // TODO: Call booking-service via Feign client
        return List.of(Map.of("message", "Connect to booking-service to get real data"));
    }

    public Map<String, Object> getDashboardStats() {
        log.info("Fetching dashboard stats (stub)");
        // TODO: Aggregate from all services
        return Map.of(
                "totalUsers", 0,
                "totalBookings", 0,
                "totalRevenue", 0.0,
                "activeWorkers", 0
        );
    }
}
