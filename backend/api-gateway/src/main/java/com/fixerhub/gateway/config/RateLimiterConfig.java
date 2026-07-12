package com.fixerhub.gateway.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import reactor.core.publisher.Mono;

@Configuration
public class RateLimiterConfig {

    // RedisRateLimiter(replenishRate tokens/sec, burstCapacity, requestedTokens per call).
    // A request is allowed only when available tokens >= requestedTokens, so
    // burstCapacity MUST be >= requestedTokens (the old values 10<... and 3<200
    // silently denied everything whenever Redis was reachable).

    @Bean
    @Primary
    public RedisRateLimiter loginRateLimiter() {
        // ~10 login attempts/min per IP: 1 token/sec, each call costs 6 → 60/6 = 10 per minute,
        // with capacity 60 allowing a burst of up to 10 back-to-back attempts.
        return new RedisRateLimiter(1, 60, 6);
    }

    @Bean
    public RedisRateLimiter forgotPasswordRateLimiter() {
        // ~3 OTP requests / 10 min per IP: 1 token/sec, cost 200 → 600/200 = 3 per 10 minutes.
        // Shared by /auth/forgot-password and /auth/reset-password (N3) — both are
        // SMS/OTP abuse surfaces, so a combined per-IP budget is intentional.
        return new RedisRateLimiter(1, 600, 200);
    }

    @Bean
    public KeyResolver ipKeyResolver() {
        return exchange -> Mono.just(
                exchange.getRequest().getRemoteAddress() != null
                        ? exchange.getRequest().getRemoteAddress().getAddress().getHostAddress()
                        : "unknown"
        );
    }
}
