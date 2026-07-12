package com.fixerhub.booking.controller;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Map;

/**
 * LIVE TRACKING: relays the en-route worker's GPS pings to the booking's
 * customer. Ephemeral — nothing is persisted.
 *
 * SECURITY (N1): WebSocketAuthInterceptor guarantees that
 *  - SEND to /app/booking/{id}/location is only accepted from the booking's
 *    assigned worker AND only while the booking status is WORKER_ON_THE_WAY;
 *  - SUBSCRIBE to /topic/booking/{id}/location is only accepted from the
 *    booking's participants (customer/worker/admin).
 */
@Controller
@RequiredArgsConstructor
public class LocationController {

    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/booking/{bookingId}/location")
    public void relayLocation(@DestinationVariable Long bookingId, LocationPing ping) {
        if (ping == null || ping.getLatitude() == null || ping.getLongitude() == null) return;
        messagingTemplate.convertAndSend("/topic/booking/" + bookingId + "/location", Map.of(
                "latitude", ping.getLatitude(),
                "longitude", ping.getLongitude(),
                "heading", ping.getHeading() != null ? ping.getHeading() : 0,
                "timestamp", System.currentTimeMillis()
        ));
    }

    @Data
    public static class LocationPing {
        private Double latitude;
        private Double longitude;
        private Double heading;
    }
}
