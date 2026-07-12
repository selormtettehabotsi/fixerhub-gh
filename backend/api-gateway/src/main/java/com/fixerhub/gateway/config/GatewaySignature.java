package com.fixerhub.gateway.config;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * SECURITY (C3): HMAC-SHA256 signature over the identity headers the gateway
 * forwards downstream. Downstream services verify this signature (with the
 * shared GATEWAY_SECRET) before trusting X-User-Email / X-User-Role / X-User-Id.
 */
public final class GatewaySignature {

    private GatewaySignature() {}

    public static String sign(String secret, String email, String role, String userId) {
        String payload = nullSafe(email) + "|" + nullSafe(role) + "|" + nullSafe(userId);
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getEncoder().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Failed to sign gateway headers", e);
        }
    }

    public static boolean verify(String secret, String email, String role, String userId, String signature) {
        if (signature == null || signature.isBlank()) return false;
        String expected = sign(secret, email, role, userId);
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8));
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s;
    }
}
