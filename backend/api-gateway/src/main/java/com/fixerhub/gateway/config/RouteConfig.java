package com.fixerhub.gateway.config;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RouteConfig {

    private final AuthFilter authFilter;

    public RouteConfig(AuthFilter authFilter) {
        this.authFilter = authFilter;
    }

    @Bean
    public RouteLocator routes(RouteLocatorBuilder builder) {
        return builder.routes()
                .route("auth-service", r -> r.path("/auth/**")
                        .uri("lb://auth-service"))
                .route("worker-service", r -> r.path("/workers/**")
                        .filters(f -> f.filter(authFilter))
                        .uri("lb://worker-service"))
                .route("booking-service", r -> r.path("/bookings/**")
                        .filters(f -> f.filter(authFilter))
                        .uri("lb://booking-service"))
                .route("payment-service", r -> r.path("/payments/**")
                        .filters(f -> f.filter(authFilter))
                        .uri("lb://payment-service"))
                .route("review-service", r -> r.path("/reviews/**")
                        .filters(f -> f.filter(authFilter))
                        .uri("lb://review-service"))
                .route("admin-service", r -> r.path("/admin/**")
                        .filters(f -> f.filter(authFilter))
                        .uri("lb://admin-service"))
                .build();
    }
}
