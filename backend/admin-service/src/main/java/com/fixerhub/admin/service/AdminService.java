package com.fixerhub.admin.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

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
                    "http://auth-service/auth/users",
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
                    "http://booking-service/bookings",
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

    public Map<String, Object> getDashboardStats() {
        log.info("Fetching dashboard stats");
        int totalUsers = 0;
        int totalBookings = 0;

        try {
            List<Map<String, Object>> users = getAllUsers();
            totalUsers = users.size();
        } catch (Exception e) {
            log.warn("Could not get user count: {}", e.getMessage());
        }

        try {
            List<Map<String, Object>> bookings = getAllBookings();
            totalBookings = bookings.size();
        } catch (Exception e) {
            log.warn("Could not get booking count: {}", e.getMessage());
        }

        return Map.of(
                "totalUsers", totalUsers,
                "totalBookings", totalBookings,
                "totalRevenue", 0.0,
                "activeWorkers", 0
        );
    }
}
