package com.fixerhub.gateway.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** M4: covers the header-signing scheme the whole C3 fix depends on. */
class GatewaySignatureTest {

    private static final String SECRET = "test-secret";

    @Test
    void signAndVerify_roundTrip() {
        String sig = GatewaySignature.sign(SECRET, "a@b.com", "CUSTOMER", "42");
        assertTrue(GatewaySignature.verify(SECRET, "a@b.com", "CUSTOMER", "42", sig));
    }

    @Test
    void verify_failsWithWrongSecret() {
        String sig = GatewaySignature.sign(SECRET, "a@b.com", "CUSTOMER", "42");
        assertFalse(GatewaySignature.verify("other-secret", "a@b.com", "CUSTOMER", "42", sig));
    }

    @Test
    void verify_failsWhenRoleTampered() {
        String sig = GatewaySignature.sign(SECRET, "a@b.com", "CUSTOMER", "42");
        assertFalse(GatewaySignature.verify(SECRET, "a@b.com", "ADMIN", "42", sig));
    }

    @Test
    void verify_failsWhenUserIdTampered() {
        String sig = GatewaySignature.sign(SECRET, "a@b.com", "CUSTOMER", "42");
        assertFalse(GatewaySignature.verify(SECRET, "a@b.com", "CUSTOMER", "7", sig));
    }

    @Test
    void verify_failsWithMissingSignature() {
        assertFalse(GatewaySignature.verify(SECRET, "a@b.com", "CUSTOMER", "42", null));
        assertFalse(GatewaySignature.verify(SECRET, "a@b.com", "CUSTOMER", "42", ""));
    }

    @Test
    void nullFieldsAreSignedAsEmptyStrings() {
        String sig = GatewaySignature.sign(SECRET, "a@b.com", "CUSTOMER", null);
        assertTrue(GatewaySignature.verify(SECRET, "a@b.com", "CUSTOMER", "", sig));
    }
}
