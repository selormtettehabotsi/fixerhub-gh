package com.fixerhub.booking.config;

import com.fixerhub.booking.service.WsAccessGuard;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * SECURITY (N1): STOMP-level authentication and authorization.
 *
 * CONNECT   — requires a valid JWT in the "Authorization" STOMP header.
 * SUBSCRIBE — only participants may subscribe to a conversation or booking topic.
 * SEND      — only participants may post to chat; only the en-route worker may
 *             publish live location (see WsAccessGuard).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private static final Pattern CHAT_ROOM  = Pattern.compile("^/(topic|app)/chat/room/([^/]+)$");
    private static final Pattern CHAT_LEGACY = Pattern.compile("^/(topic|app)/chat/(\\d+)$");
    private static final Pattern BOOKING_LOC = Pattern.compile("^/(topic|app)/booking/(\\d+)/location$");

    private final WsJwtVerifier jwtVerifier;
    private final WsAccessGuard accessGuard;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) return message;

        switch (accessor.getCommand()) {
            case CONNECT -> {
                String auth = accessor.getFirstNativeHeader("Authorization");
                WsJwtVerifier.WsUser user = jwtVerifier.verify(auth);
                if (user == null) {
                    log.warn("WS CONNECT rejected: missing/invalid token");
                    throw new IllegalArgumentException("Unauthorized WebSocket connection");
                }
                accessor.setUser(user);
            }
            case SUBSCRIBE -> authorize(accessor, accessor.getDestination(), false);
            case SEND -> authorize(accessor, accessor.getDestination(), true);
            default -> { }
        }
        return message;
    }

    private void authorize(StompHeaderAccessor accessor, String destination, boolean isSend) {
        if (destination == null) return;
        WsJwtVerifier.WsUser user = accessor.getUser() instanceof WsJwtVerifier.WsUser u ? u : null;
        if (user == null) {
            throw new IllegalArgumentException("Unauthenticated WebSocket frame");
        }
        Long userId = Long.valueOf(user.userId());

        Matcher room = CHAT_ROOM.matcher(destination);
        if (room.matches()) {
            if (!accessGuard.canAccessConversation(userId, user.role(), room.group(2))) {
                deny(user, destination);
            }
            return;
        }
        Matcher legacy = CHAT_LEGACY.matcher(destination);
        if (legacy.matches()) {
            if (!accessGuard.isBookingParticipant(userId, user.role(), Long.valueOf(legacy.group(2)))) {
                deny(user, destination);
            }
            return;
        }
        Matcher loc = BOOKING_LOC.matcher(destination);
        if (loc.matches()) {
            Long bookingId = Long.valueOf(loc.group(2));
            boolean allowed = isSend
                    ? accessGuard.canPublishLocation(userId, bookingId)          // only the en-route worker sends
                    : accessGuard.isBookingParticipant(userId, user.role(), bookingId); // participants may watch
            if (!allowed) deny(user, destination);
            return;
        }
        // Unknown destination — deny by default.
        deny(user, destination);
    }

    private void deny(WsJwtVerifier.WsUser user, String destination) {
        log.warn("WS access denied: user={} dest={}", user.userId(), destination);
        throw new IllegalArgumentException("Access denied to " + destination);
    }
}
