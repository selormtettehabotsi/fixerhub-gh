package com.fixerhub.gateway.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RouteConfig {

    private final AuthFilter authFilter;
    private final RedisRateLimiter loginRateLimiter;
    private final RedisRateLimiter forgotPasswordRateLimiter;
    private final KeyResolver ipKeyResolver;

    public RouteConfig(AuthFilter authFilter,
                       RedisRateLimiter loginRateLimiter,
                       RedisRateLimiter forgotPasswordRateLimiter,
                       KeyResolver ipKeyResolver) {
        this.authFilter = authFilter;
        this.loginRateLimiter = loginRateLimiter;
        this.forgotPasswordRateLimiter = forgotPasswordRateLimiter;
        this.ipKeyResolver = ipKeyResolver;
    }

    @Bean
    public RouteLocator routes(RouteLocatorBuilder builder) {
        return builder.routes()
                // SECURITY (C4): internal service-to-service endpoints must never be
                // reachable through the gateway — block them outright.
                .route("block-internal", r -> r.path(
                                "/auth/internal/**", "/bookings/internal/**",
                                "/payments/internal/**", "/workers/internal/**")
                        .filters(f -> f.filter((exchange, chain) -> {
                            exchange.getResponse().setStatusCode(org.springframework.http.HttpStatus.FORBIDDEN);
                            return exchange.getResponse().setComplete();
                        }))
                        .uri("no://op"))

                // Rate-limited auth routes (must come before generic auth route)
                .route("auth-login-limited", r -> r.path("/auth/login")
                        .filters(f -> f.requestRateLimiter(c -> {
                            c.setRateLimiter(loginRateLimiter);
                            c.setKeyResolver(ipKeyResolver);
                            c.setDenyEmptyKey(false);
                        }))
                        .uri("lb://auth-service"))
                .route("auth-forgot-limited", r -> r.path("/auth/forgot-password")
                        .filters(f -> f.requestRateLimiter(c -> {
                            c.setRateLimiter(forgotPasswordRateLimiter);
                            c.setKeyResolver(ipKeyResolver);
                            c.setDenyEmptyKey(false);
                        }))
                        .uri("lb://auth-service"))
                // SECURITY (N3): reset-password shares the OTP abuse budget so the
                // 6-digit OTP can't be brute-forced from the network side either.
                .route("auth-reset-limited", r -> r.path("/auth/reset-password")
                        .filters(f -> f.requestRateLimiter(c -> {
                            c.setRateLimiter(forgotPasswordRateLimiter);
                            c.setKeyResolver(ipKeyResolver);
                            c.setDenyEmptyKey(false);
                        }))
                        .uri("lb://auth-service"))
                // M1: registration rate-limited (spam accounts / SMS-less abuse)
                .route("auth-register-limited", r -> r.path("/auth/register")
                        .filters(f -> f.requestRateLimiter(c -> {
                            c.setRateLimiter(loginRateLimiter);
                            c.setKeyResolver(ipKeyResolver);
                            c.setDenyEmptyKey(false);
                        }))
                        .uri("lb://auth-service"))
                // VERIFICATION: OTP sends share the abuse budget with password reset
                .route("auth-verify-send-limited", r -> r.path("/auth/verify/send")
                        .filters(f -> f.requestRateLimiter(c -> {
                            c.setRateLimiter(forgotPasswordRateLimiter);
                            c.setKeyResolver(ipKeyResolver);
                            c.setDenyEmptyKey(false);
                        }))
                        .uri("lb://auth-service"))
                .route("auth-service", r -> r.path("/auth/**")
                        .uri("lb://auth-service"))

                // SECURITY (H1): own-profile route carries PII — always authenticated,
                // must come before the public worker GET routes.
                .route("worker-by-user", r -> r.path("/workers/by-user/**")
                        .filters(f -> f.filter(authFilter))
                        .uri("lb://worker-service"))

                // Public GET routes for workers (before authenticated)
                .route("worker-portfolio-public", r -> r.path("/workers/*/portfolio")
                        .and().method("GET")
                        .uri("lb://worker-service"))
                .route("worker-service-public", r -> r.path("/workers/**")
                        .and().method("GET")
                        .uri("lb://worker-service"))
                .route("worker-service", r -> r.path("/workers/**")
                        .filters(f -> f.filter(authFilter))
                        .uri("lb://worker-service"))

                // WebSocket handshake — auth happens at STOMP CONNECT inside booking-service (N1)
                .route("booking-chat-ws", r -> r.path("/ws/**")
                        .uri("lb://booking-service"))
                // SECURITY (N1): chat history is authenticated like any other API
                .route("booking-chat-history", r -> r.path("/chat/**")
                        .filters(f -> f.filter(authFilter))
                        .uri("lb://booking-service"))

                // SECURITY (C4): booking routes now require authentication —
                // ownership is enforced inside booking-service.
                .route("booking-service", r -> r.path("/bookings/**")
                        .filters(f -> f.filter(authFilter))
                        .uri("lb://booking-service"))

                // RETENTION: customer favorites live in booking-service
                .route("favorites", r -> r.path("/favorites/**")
                        .filters(f -> f.filter(authFilter))
                        .uri("lb://booking-service"))

                // WEBHOOK: Paystack calls this without a JWT — the payment
                // service authenticates it via the HMAC signature header.
                .route("payment-webhook", r -> r.path("/payments/webhook")
                        .and().method("POST")
                        .uri("lb://payment-service"))
                .route("payment-service", r -> r.path("/payments/**")
                        .filters(f -> f.filter(authFilter))
                        .uri("lb://payment-service"))

                .route("review-service-public", r -> r.path("/reviews/**")
                        .and().method("GET")
                        .uri("lb://review-service"))
                .route("review-service", r -> r.path("/reviews/**")
                        .filters(f -> f.filter(authFilter))
                        .uri("lb://review-service"))

                .route("admin-service", r -> r.path("/admin/**")
                        .filters(f -> f.filter(authFilter))
                        .uri("lb://admin-service"))

                // SECURITY (N2): the payment-receipt endpoint is intentionally NOT
                // routed. payment-service calls notification-service directly via
                // Eureka; exposing it here let anyone send SMS through our account.
                .build();
    }
}
