package com.fixerhub.booking.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.Principal;

/**
 * SECURITY (N1): WebSocket connections can't carry the gateway-signed headers,
 * so booking-service validates the JWT itself at STOMP CONNECT time.
 */
@Component
public class WsJwtVerifier {

    @Value("${jwt.secret}")
    private String jwtSecret;

    /** Authenticated WebSocket user: name = numeric userId as string. */
    public record WsUser(String userId, String email, String role) implements Principal {
        @Override
        public String getName() {
            return userId;
        }
    }

    /** Returns the authenticated user, or null if the token is missing/invalid. */
    public WsUser verify(String bearerToken) {
        if (bearerToken == null || !bearerToken.startsWith("Bearer ")) return null;
        try {
            Key key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
            Claims claims = Jwts.parserBuilder().setSigningKey(key).build()
                    .parseClaimsJws(bearerToken.substring(7)).getBody();
            Long userId = claims.get("userId", Long.class);
            if (userId == null) return null;
            return new WsUser(String.valueOf(userId), claims.getSubject(), claims.get("role", String.class));
        } catch (Exception e) {
            return null;
        }
    }
}
