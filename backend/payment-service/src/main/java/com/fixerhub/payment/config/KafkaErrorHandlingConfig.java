package com.fixerhub.payment.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

/**
 * M3: without an error handler, a listener-level failure (e.g. deserialization,
 * transient DB outage) can poison-pill the partition or silently drop events.
 * Retry 3× with 2s backoff, then log-and-skip so the stream keeps flowing.
 * Spring Boot auto-wires a single CommonErrorHandler bean into the listener factory.
 */
@Slf4j
@Configuration
public class KafkaErrorHandlingConfig {

    @Bean
    public DefaultErrorHandler kafkaErrorHandler() {
        DefaultErrorHandler handler = new DefaultErrorHandler(
                (record, ex) -> log.error("Kafka event dropped after retries: topic={} offset={} cause={}",
                        record.topic(), record.offset(), ex.getMessage()),
                new FixedBackOff(2000L, 3));
        return handler;
    }
}
