package com.fixerhub.payment.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class MomoService {

    // TODO: integrate real MTN MoMo Collections API later
    public String processPayment(Long bookingId, Double amount) {
        log.info("Processing MoMo payment for booking {}, amount {}", bookingId, amount);
        return "MOMO-REF-" + bookingId;
    }
}
