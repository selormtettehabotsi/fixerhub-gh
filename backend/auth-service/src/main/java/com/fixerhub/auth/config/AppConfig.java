package com.fixerhub.auth.config;

import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AppConfig {

    @Bean
    @LoadBalanced
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }

    /**
     * SMS FIX: a PLAIN RestTemplate for external APIs (African's Talking).
     * The @LoadBalanced one treats hostnames as Eureka service names, so any
     * call to api.sandbox.africastalking.com failed with "no instances
     * available" — silently breaking every SMS from auth-service.
     */
    @Bean
    public RestTemplate externalRestTemplate() {
        return new RestTemplate();
    }
}
