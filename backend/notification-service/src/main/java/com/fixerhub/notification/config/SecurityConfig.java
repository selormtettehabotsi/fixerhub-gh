package com.fixerhub.notification.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Internal service-to-service calls from payment-service carry no auth token
                .requestMatchers("/notifications/**").permitAll()
                // Keep actuator health/info/metrics reachable (no auth mechanism on this service)
                .requestMatchers("/actuator/**").permitAll()
                .anyRequest().authenticated()
            );
        return http.build();
    }
}
