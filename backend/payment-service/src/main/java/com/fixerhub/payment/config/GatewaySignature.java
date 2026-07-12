package com.fixerhub.payment.config;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * SECURITY (C3): verifies the HMAC-SHA256 signature the gateway attaches to
 * the X-User-* identity headers. Without a valid signature the headers are
 * ignored, so direct calls to this service cannot forge an identity.
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
            throw new IllegalStateException("Failed to compute gateway header signature", e);
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
