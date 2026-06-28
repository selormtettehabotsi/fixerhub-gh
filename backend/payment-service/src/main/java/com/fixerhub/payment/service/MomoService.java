package com.fixerhub.payment.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
public class MomoService {

    @Value("${momo.base-url}")
    private String baseUrl;

    @Value("${momo.subscription-key}")
    private String subscriptionKey;

    @Value("${momo.api-user}")
    private String apiUser;

    @Value("${momo.api-key}")
    private String apiKey;

    @Value("${momo.environment}")
    private String environment;

    @Value("${momo.callback-url}")
    private String callbackUrl;

    @Value("${momo.currency}")
    private String currency;

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Get OAuth access token from MTN MoMo Collections API.
     */
    private String getAccessToken() {
        String credentials = apiUser + ":" + apiKey;
        String encoded = Base64.getEncoder().encodeToString(credentials.getBytes());

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Basic " + encoded);
        headers.set("Ocp-Apim-Subscription-Key", subscriptionKey);

        HttpEntity<Void> request = new HttpEntity<>(headers);
        ResponseEntity<Map> response = restTemplate.exchange(
                baseUrl + "/collection/token/",
                HttpMethod.POST,
                request,
                Map.class
        );

        Map<?, ?> body = response.getBody();
        if (body == null || !body.containsKey("access_token")) {
            throw new RuntimeException("Failed to retrieve MoMo access token");
        }
        return (String) body.get("access_token");
    }

    /**
     * Initiate a MoMo Collection (RequestToPay).
     * In sandbox, the payment is auto-approved.
     *
     * @param bookingId  the booking reference
     * @param amount     payment amount in GHS
     * @param phoneNumber payer's phone number (format: 233XXXXXXXXX)
     * @return MTN MoMo external transaction ID
     */
    public String processPayment(Long bookingId, Double amount, String phoneNumber) {
        try {
            String accessToken = getAccessToken();
            String externalId = UUID.randomUUID().toString();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + accessToken);
            headers.set("Ocp-Apim-Subscription-Key", subscriptionKey);
            headers.set("X-Reference-Id", externalId);
            headers.set("X-Target-Environment", environment);
            if (!environment.equals("sandbox")) {
                headers.set("X-Callback-Url", callbackUrl);
            }

            Map<String, Object> requestBody = Map.of(
                    "amount", String.valueOf(amount),
                    "currency", currency,
                    "externalId", externalId,
                    "payer", Map.of(
                            "partyIdType", "MSISDN",
                            "partyId", phoneNumber != null ? phoneNumber : "000000000000"
                    ),
                    "payerMessage", "Payment for FixerHub booking #" + bookingId,
                    "payeeNote", "FixerHub booking #" + bookingId
            );

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            ResponseEntity<Void> response = restTemplate.postForEntity(
                    baseUrl + "/collection/v1_0/requesttopay",
                    request,
                    Void.class
            );

            if (response.getStatusCode() == HttpStatus.ACCEPTED
                    || response.getStatusCode() == HttpStatus.OK) {
                log.info("MoMo payment initiated. ExternalId: {} | Booking: {}", externalId, bookingId);
                return externalId;
            } else {
                log.warn("MoMo returned unexpected status: {}", response.getStatusCode());
                return "MOMO-FAILED-" + bookingId;
            }
        } catch (Exception e) {
            log.error("MoMo payment failed for booking {}: {}", bookingId, e.getMessage());
            // Return a fallback reference so the payment record is still saved
            return "MOMO-ERROR-" + bookingId;
        }
    }

    /**
     * Overload for backward compatibility — called from Kafka consumer without phone number.
     */
    public String processPayment(Long bookingId, Double amount) {
        return processPayment(bookingId, amount, null);
    }
}
