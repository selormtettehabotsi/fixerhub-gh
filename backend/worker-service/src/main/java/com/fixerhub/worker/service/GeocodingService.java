package com.fixerhub.worker.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class GeocodingService {

    @Value("${google.maps.api-key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private static final String GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";

    /**
     * Converts a location string (e.g. "Accra, Ghana") to [latitude, longitude].
     * Returns null if geocoding fails.
     */
    public double[] geocode(String location) {
        try {
            String url = UriComponentsBuilder.fromHttpUrl(GEOCODING_URL)
                    .queryParam("address", location)
                    .queryParam("key", apiKey)
                    .toUriString();

            Map<String, Object> response = restTemplate.getForObject(url, Map.class);

            if (response == null) return null;

            String status = (String) response.get("status");
            if (!"OK".equals(status)) {
                log.warn("Geocoding failed for '{}': status={}", location, status);
                return null;
            }

            List<Map<String, Object>> results = (List<Map<String, Object>>) response.get("results");
            if (results == null || results.isEmpty()) return null;

            Map<String, Object> geometry = (Map<String, Object>) results.get(0).get("geometry");
            Map<String, Object> loc = (Map<String, Object>) geometry.get("location");

            double lat = ((Number) loc.get("lat")).doubleValue();
            double lng = ((Number) loc.get("lng")).doubleValue();

            log.info("Geocoded '{}' → lat={}, lng={}", location, lat, lng);
            return new double[]{lat, lng};

        } catch (Exception e) {
            log.error("Geocoding error for '{}': {}", location, e.getMessage());
            return null;
        }
    }

    /**
     * Haversine formula — calculates distance in km between two lat/lng points.
     */
    public double distanceKm(double lat1, double lng1, double lat2, double lng2) {
        final double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
