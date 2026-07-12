package com.fixerhub.payment.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** M4: GHS → pesewa conversion must be exact (Paystack takes integer pesewas). */
class PaystackServiceTest {

    @Test
    void toPesewas_wholeAmounts() {
        assertEquals(15000L, PaystackService.toPesewas(new BigDecimal("150.00")));
        assertEquals(100L, PaystackService.toPesewas(BigDecimal.ONE));
    }

    @Test
    void toPesewas_twoDecimalPlaces() {
        assertEquals(14250L, PaystackService.toPesewas(new BigDecimal("142.50")));
        assertEquals(3333L, PaystackService.toPesewas(new BigDecimal("33.33")));
    }

    @Test
    void toPesewas_roundsHalfUpBeyondTwoDecimals() {
        assertEquals(10000L, PaystackService.toPesewas(new BigDecimal("99.999")));
        assertEquals(2L, PaystackService.toPesewas(new BigDecimal("0.015")));
    }
}
