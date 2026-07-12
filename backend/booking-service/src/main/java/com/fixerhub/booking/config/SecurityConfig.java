package com.fixerhub.booking.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.util.Map;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final ObjectMapper  objectMapper;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            .authorizeHttpRequests(auth -> auth
                // WebSocket handshake — no HTTP auth; STOMP CONNECT enforces the JWT (N1)
                .requestMatchers("/ws/**", "/ws/info/**").permitAll()
                // SECURITY (N1): chat history requires auth; ownership checked in ChatController
                .requestMatchers("/chat/**").authenticated()

                // Internal service-to-service endpoint (admin-service, direct call —
                // blocked at the gateway so it is never reachable from outside)
                .requestMatchers(HttpMethod.GET,  "/bookings/internal/**").permitAll()

                // SECURITY (C4): booking reads require authentication; ownership is
                // enforced per-request by BookingAccessGuard.
                .requestMatchers(HttpMethod.GET,  "/bookings/**").authenticated()

                // Role-restricted write access
                .requestMatchers(HttpMethod.POST, "/bookings").hasAnyRole("CUSTOMER", "ADMIN")
                .requestMatchers(HttpMethod.PUT,  "/bookings/*/status").hasAnyRole("WORKER", "ADMIN")

                // Everything else requires authentication
                .anyRequest().authenticated()
            )

            // 401 — no authentication present
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write(
                        objectMapper.writeValueAsString(Map.of("error", "Unauthorized"))
                    );
                })
                // 403 — authenticated but wrong role
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write(
                        objectMapper.writeValueAsString(Map.of("error", "Forbidden"))
                    );
                })
            )

            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
