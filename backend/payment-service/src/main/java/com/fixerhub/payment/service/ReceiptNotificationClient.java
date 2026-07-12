package com.fixerhub.payment.service;

import com.fixerhub.payment.model.Payment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReceiptNotificationClient {

    @Qualifier("loadBalancedRestTemplate")
    private final RestTemplate loadBalancedRestTemplate;

    /** Fire-and-forget call to notification-service to send the payment receipt. */
    public void sendPaymentReceipt(Payment payment) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("customerPhone", payment.getCustomerPhone());
            body.put("customerEmail", payment.getCustomerEmail());
            body.put("workerPhone", payment.getWorkerPhone());
            body.put("bookingId", payment.getBookingId());
            body.put("serviceType", payment.getServiceType());
            body.put("amount", payment.getAmount());
            body.put("workerAmount", payment.getWorkerAmount());
            body.put("transactionRef", payment.getPaystackReference());
            body.put("workerName", payment.getWorkerName());
            body.put("customerName", null);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            loadBalancedRestTemplate.postForEntity(
                    "http://notification-service/notifications/payment-receipt", entity, Object.class);
            log.info("Payment receipt notification sent for bookingId={}", payment.getBookingId());
        } catch (Exception e) {
            log.error("Failed to send payment receipt for bookingId={}: {}",
                    payment.getBookingId(), e.getMessage());
        }
    }
}
