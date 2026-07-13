package com.fixerhub.payment.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class PaystackService {

    @Value("${paystack.secret-key}")
    private String secretKey;

    @Value("${paystack.base-url:https://api.paystack.co}")
    private String baseUrl;

    private final RestTemplate restTemplate;

    public PaystackService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(15_000);
        this.restTemplate = new RestTemplate(factory);
    }

    /** MONEY (H2): converts a GHS amount to integer pesewas with HALF_UP rounding. */
    static long toPesewas(BigDecimal amountGhs) {
        return amountGhs.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    /** Initialize a Paystack transaction for a booking. Returns { authorizationUrl, reference }. */
    public Map<String, String> initializePayment(String customerEmail, BigDecimal amountGhs, Long bookingId) {
        return initializeWithReference(customerEmail, amountGhs,
                "FH-" + bookingId + "-" + System.currentTimeMillis());
    }

    /** Initialize a Paystack transaction with an explicit reference (bookings, subscriptions, ...). */
    @SuppressWarnings("unchecked")
    public Map<String, String> initializeWithReference(String customerEmail, BigDecimal amountGhs, String reference) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + secretKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("email", customerEmail != null && !customerEmail.isBlank() ? customerEmail : "customer@fixerhub.com");
        body.put("amount", toPesewas(amountGhs)); // pesewas
        body.put("currency", "GHS");
        body.put("reference", reference);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<Map> resp = restTemplate.postForEntity(baseUrl + "/transaction/initialize", entity, Map.class);
        if (resp.getBody() == null || resp.getBody().get("data") == null) {
            throw new RuntimeException("Paystack initialization failed: empty response");
        }
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        if (data.get("authorization_url") == null || data.get("reference") == null) {
            throw new RuntimeException("Paystack initialization failed: missing authorization_url or reference");
        }
        return Map.of(
                "authorizationUrl", data.get("authorization_url").toString(),
                "reference", data.get("reference").toString()
        );
    }

    /**
     * Creates a Paystack transfer recipient for Ghana mobile money.
     * @param name       Worker display name
     * @param phone      Worker's MoMo phone number (e.g. "0241234567")
     * @param bankCode   Paystack Ghana MoMo bank code: "MTN" | "VDF" | "ATL"
     * @return recipient_code to pass to initiateTransfer()
     */
    @SuppressWarnings("unchecked")
    public String createTransferRecipient(String name, String phone, String bankCode) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + secretKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("type", "mobile_money");
        body.put("name", name != null ? name : "Worker");
        body.put("account_number", phone);
        body.put("bank_code", bankCode);
        body.put("currency", "GHS");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<Map> resp = restTemplate.postForEntity(
                baseUrl + "/transferrecipient", entity, Map.class);

        if (resp.getBody() == null || resp.getBody().get("data") == null) {
            throw new RuntimeException("Paystack transfer recipient creation failed: empty response");
        }
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        Object recipientCode = data.get("recipient_code");
        if (recipientCode == null) {
            throw new RuntimeException("Paystack transfer recipient creation failed: no recipient_code in response");
        }
        log.info("Paystack transfer recipient created — phone={}, bankCode={}, recipientCode={}",
                phone, bankCode, recipientCode);
        return recipientCode.toString();
    }

    /**
     * Initiates a Paystack transfer from FixerHub's balance to a recipient.
     * @param amountGhs    Amount in Ghana Cedis (will be converted to pesewas)
     * @param recipientCode Recipient code from createTransferRecipient()
     * @param bookingId    Used in the transfer reason/memo
     * @return Paystack transfer reference
     */
    @SuppressWarnings("unchecked")
    public String initiateTransfer(BigDecimal amountGhs, String recipientCode, Long bookingId) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + secretKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("source", "balance");
        body.put("amount", toPesewas(amountGhs)); // convert GHS to pesewas
        body.put("recipient", recipientCode);
        // IDEMPOTENCY (H3): a fixed per-booking reference — Paystack rejects a
        // duplicate transfer reference, so a replayed payout cannot pay twice.
        body.put("reference", "FH-PAYOUT-" + bookingId);
        body.put("reason", "FixerHub worker payout — Booking #" + bookingId);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<Map> resp = restTemplate.postForEntity(
                baseUrl + "/transfer", entity, Map.class);

        if (resp.getBody() == null || resp.getBody().get("data") == null) {
            throw new RuntimeException("Paystack transfer initiation failed: empty response");
        }
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        Object reference = data.get("reference");
        if (reference == null) {
            throw new RuntimeException("Paystack transfer initiation failed: no reference in response");
        }
        log.info("Paystack transfer initiated — bookingId={}, amount={} GHS, recipientCode={}, ref={}",
                bookingId, amountGhs, recipientCode, reference);
        return reference.toString();
    }

    /** Status + amount from a Paystack verification. Amount is in pesewas. */
    public record VerifyResult(String status, Long amountPesewas) {}

    /** Verify a Paystack transaction by reference — returns status AND the amount actually paid. */
    @SuppressWarnings("unchecked")
    public VerifyResult verifyTransaction(String reference) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + secretKey);
        ResponseEntity<Map> resp = restTemplate.exchange(
                baseUrl + "/transaction/verify/" + reference, HttpMethod.GET,
                new HttpEntity<>(headers), Map.class);
        if (resp.getBody() == null || resp.getBody().get("data") == null) {
            throw new RuntimeException("Paystack verification failed: empty response");
        }
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        String status = data.get("status") == null ? "failed" : data.get("status").toString();
        Long amount = data.get("amount") == null ? null : Long.valueOf(data.get("amount").toString());
        return new VerifyResult(status, amount);
    }

    /** Back-compat wrapper (status only). */
    public String verifyPayment(String reference) {
        return verifyTransaction(reference).status();
    }

    /** REFUNDS: refund a charged transaction (full amount). Returns Paystack's refund status. */
    @SuppressWarnings("unchecked")
    public String refundTransaction(String reference) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + secretKey);
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> body = Map.of("transaction", reference);
        ResponseEntity<Map> resp = restTemplate.postForEntity(
                baseUrl + "/refund", new HttpEntity<>(body, headers), Map.class);
        if (resp.getBody() == null || resp.getBody().get("data") == null) {
            throw new RuntimeException("Paystack refund failed: empty response");
        }
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        String status = data.get("status") == null ? "pending" : data.get("status").toString();
        log.info("Paystack refund initiated for reference={} — status={}", reference, status);
        return status;
    }
}
