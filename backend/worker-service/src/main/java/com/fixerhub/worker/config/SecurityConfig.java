package com.fixerhub.worker.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Autowired
    private JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, e) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"error\": \"Unauthorized\"}");
                        })
                        .accessDeniedHandler((request, response, e) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"error\": \"Access denied\"}");
                        })
                )
                .authorizeHttpRequests(auth -> auth
                        // Internal service-to-service paths — blocked at the gateway (C4),
                        // so only services on the internal network can reach them (M4 delete etc.)
                        .requestMatchers("/workers/internal/**").permitAll()
                        // SECURITY (H1): own-profile view carries PII — must be authenticated
                        .requestMatchers(HttpMethod.GET, "/workers/by-user/**").authenticated()
                        // Public GET routes — browsing workers requires no auth
                        // (public responses are sanitized of PII in WorkerController)
                        .requestMatchers(HttpMethod.GET, "/workers/**").permitAll()
                        // Internal: auth-service creates worker profile on WORKER register (no JWT in that call)
                        .requestMatchers(HttpMethod.POST, "/workers").permitAll()
                        // Internal: review-service updates rating after a review is submitted.
                        // This is a trusted service-to-service call (no JWT), so must be permitAll.
                        .requestMatchers(HttpMethod.PUT, "/workers/*/rating").permitAll()
                        // Internal: admin-service calls these KYC endpoints service-to-service (no JWT).
                        // Must be permitAll — /internal/ paths are never exposed through the gateway,
                        // so only services on the internal network can reach them.
                        .requestMatchers(HttpMethod.PUT, "/workers/internal/*/verification/approve").permitAll()
                        .requestMatchers(HttpMethod.PUT, "/workers/internal/*/verification/decline").permitAll()
                        .requestMatchers(HttpMethod.PUT, "/workers/internal/*/verification/request-resubmit").permitAll()
                        // Only ADMIN can verify or unverify workers
                        .requestMatchers(HttpMethod.PUT, "/workers/*/verify").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/workers/*/unverify").hasRole("ADMIN")
                        // Workers and admins can toggle availability or sync profile picture
                        .requestMatchers(HttpMethod.PUT, "/workers/*/availability").hasAnyRole("WORKER", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/workers/by-user/*/availability").hasAnyRole("WORKER", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/workers/by-user/*/profile-picture").hasAnyRole("WORKER", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/workers/by-user/*/pricing").hasAnyRole("WORKER", "ADMIN")
                        // Workers and admins can submit KYC documents
                        .requestMatchers(HttpMethod.POST, "/workers/*/verification/submit").hasAnyRole("WORKER", "ADMIN")
                        // Only ADMIN can review KYC submissions
                        .requestMatchers(HttpMethod.PUT, "/workers/*/verification/approve").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/workers/*/verification/decline").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/workers/*/verification/request-resubmit").hasRole("ADMIN")
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
