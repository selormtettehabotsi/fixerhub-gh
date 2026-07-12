package com.fixerhub.payment.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.util.Map;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final ObjectMapper objectMapper;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Internal calls from other services — no auth needed
                .requestMatchers("/payments/internal/**").permitAll()
                // Only customers can initiate or verify Paystack payments
                .requestMatchers(org.springframework.http.HttpMethod.GET,  "/payments/booking/*/pay-url").hasRole("CUSTOMER")
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/payments/booking/*/verify").hasRole("CUSTOMER")
                // Workers can view their own payment summaries/history
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/payments/worker/**").hasAnyRole("WORKER", "ADMIN")
                // Everything else just requires authentication
                .requestMatchers("/payments/**").authenticated()
                .anyRequest().authenticated()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, e) -> {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write(
                        objectMapper.writeValueAsString(Map.of("error", "Unauthorized"))
                    );
                })
                .accessDeniedHandler((request, response, e) -> {
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
