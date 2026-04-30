package com.fixerhub.payment.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.UUID;

@Slf4j
@Service
public class MomoService {

    /**
     * Stub for MTN MoMo API integration.
     * Replace with actual MTN MoMo REST API calls using the sandbox/production credentials.
     */
    public String initiatePayment(String momoNumber, BigDecimal amount) {
        String reference = "MOMO-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        log.info("Initiating MoMo payment: number={}, amount={} GHS, ref={}", momoNumber, amount, reference);
        // TODO: Call MTN MoMo Collections API here
        return reference;
    }
}
