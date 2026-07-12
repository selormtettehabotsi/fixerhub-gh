package com.fixerhub.notification.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

/** M3: retry 3× with 2s backoff, then log-and-skip — see payment-service twin. */
@Slf4j
@Configuration
public class KafkaErrorHandlingConfig {

    @Bean
    public DefaultErrorHandler kafkaErrorHandler() {
        return new DefaultErrorHandler(
                (record, ex) -> log.error("Kafka event dropped after retries: topic={} offset={} cause={}",
                        record.topic(), record.offset(), ex.getMessage()),
                new FixedBackOff(2000L, 3));
    }
}
