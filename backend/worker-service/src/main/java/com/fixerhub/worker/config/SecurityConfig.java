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
                        // Public GET routes — browsing workers requires no auth
                        .requestMatchers(HttpMethod.GET, "/workers/**").permitAll()
                        // Internal: auth-service creates worker profile on WORKER register (no JWT in that call)
                        .requestMatchers(HttpMethod.POST, "/workers").permitAll()
                        // Internal: review-service updates rating after a review is submitted
                        .requestMatchers(HttpMethod.PUT, "/workers/*/rating").authenticated()
                        // Only ADMIN can verify or unverify workers
                        .requestMatchers(HttpMethod.PUT, "/workers/*/verify").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/workers/*/unverify").hasRole("ADMIN")
                        // Workers and admins can toggle availability
                        .requestMatchers(HttpMethod.PUT, "/workers/*/availability").hasAnyRole("WORKER", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/workers/by-user/*/availability").hasAnyRole("WORKER", "ADMIN")
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
