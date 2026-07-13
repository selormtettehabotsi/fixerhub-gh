package com.fixerhub.payment.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fixerhub.payment.model.Payment;
import com.fixerhub.payment.repository.PaymentRepository;
import com.fixerhub.payment.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * WEBHOOK: Paystack calls this directly on charge.success, so payments settle
 * even if the customer never taps "I've paid" (closed browser, lost network).
 *
 * Security: no JWT — authenticity comes from the x-paystack-signature header,
 * an HMAC-SHA512 of the raw body keyed with the Paystack secret key, compared
 * in constant time. The gateway exposes this route publicly.
 *
 * In production, set the webhook URL in the Paystack dashboard to
 * https://<your-domain>/payments/webhook (use ngrok for local demos).
 */
@Slf4j
@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class PaystackWebhookController {

    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;
    private final com.fixerhub.payment.service.SubscriptionService subscriptionService;
    private final ObjectMapper objectMapper;

    @Value("${paystack.secret-key}")
    private String secretKey;

    @PostMapping("/webhook")
    public ResponseEntity<Void> handleWebhook(
            @RequestBody String rawBody,
            @RequestHeader(value = "x-paystack-signature", required = false) String signature) {

        if (signature == null || !signatureValid(rawBody, signature)) {
            log.warn("Rejected Paystack webhook with missing/invalid signature");
            return ResponseEntity.status(401).build();
        }

        try {
            JsonNode root = objectMapper.readTree(rawBody);
            String event = root.path("event").asText("");
            String reference = root.path("data").path("reference").asText("");

            if ("charge.success".equals(event) && !reference.isBlank()) {
                if (reference.startsWith("FH-SUB-")) {
                    // Worker Pro subscription purchase
                    subscriptionService.verifyFromWebhook(reference);
                } else {
                    paymentRepository.findByPaystackReference(reference).ifPresentOrElse(
                            (Payment payment) -> {
                                String status = paymentService.confirmAndSettle(payment);
                                log.info("Webhook settled reference={} -> {}", reference, status);
                            },
                            () -> log.info("Webhook for unknown reference={} — ignoring", reference));
                }
            } else {
                log.info("Webhook event '{}' ignored", event);
            }
        } catch (Exception e) {
            // Never let processing errors bubble into a non-200: Paystack would
            // retry forever. The customer-side verify remains the fallback.
            log.error("Webhook processing error: {}", e.getMessage());
        }
        // Always 200 once the signature checks out — acknowledges receipt.
        return ResponseEntity.ok().build();
    }

    private boolean signatureValid(String rawBody, String signature) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            String computed = HexFormat.of().formatHex(mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8)));
            return MessageDigest.isEqual(
                    computed.getBytes(StandardCharsets.UTF_8),
                    signature.toLowerCase().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.error("Webhook signature check failed: {}", e.getMessage());
            return false;
        }
    }
}
