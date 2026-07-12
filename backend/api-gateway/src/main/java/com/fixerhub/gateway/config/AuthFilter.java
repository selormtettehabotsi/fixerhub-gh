package com.fixerhub.gateway.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.security.Key;

@Component
public class AuthFilter implements GatewayFilter {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${gateway.secret}")
    private String gatewaySecret;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        // SECURITY (N1): /chat/** now requires auth (removed from the skip list);
        // /ws/** stays open here because STOMP CONNECT enforces the JWT instead.
        if (path.startsWith("/auth/") || path.startsWith("/ws/")) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        try {
            String token = authHeader.substring(7);
            Key key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
            Claims claims = Jwts.parserBuilder().setSigningKey(key).build()
                    .parseClaimsJws(token).getBody();

            String role = claims.get("role", String.class);
            Long userIdClaim = claims.get("userId", Long.class);

            String email    = claims.getSubject();
            String safeRole = role != null ? role : "";
            String userId   = userIdClaim != null ? String.valueOf(userIdClaim) : "";

            // SECURITY (C3): sign the forwarded identity headers so downstream
            // services can reject forged X-User-* headers on direct calls.
            String signature = GatewaySignature.sign(gatewaySecret, email, safeRole, userId);

            ServerWebExchange mutated = exchange.mutate()
                    .request(r -> r
                            .header("X-User-Email", email)
                            .header("X-User-Role", safeRole)
                            .header("X-User-Id", userId)
                            .header("X-Gateway-Signature", signature))
                    .build();

            return chain.filter(mutated);
        } catch (Exception e) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
    }
}
