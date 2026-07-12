package com.fixerhub.gateway.config;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * SECURITY (C3): strips any client-supplied identity headers on EVERY route
 * (including public ones that bypass AuthFilter) so that downstream services
 * only ever see X-User-* headers that the gateway itself injected and signed.
 */
@Component
public class HeaderSanitizerFilter implements GlobalFilter, Ordered {

    static final String[] RESERVED_HEADERS = {
            "X-User-Email", "X-User-Role", "X-User-Id", "X-Gateway-Signature"
    };

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerWebExchange sanitized = exchange.mutate()
                .request(r -> {
                    for (String header : RESERVED_HEADERS) {
                        r.headers(h -> h.remove(header));
                    }
                })
                .build();
        return chain.filter(sanitized);
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
