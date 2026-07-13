package com.fixerhub.payment.service;

import com.fixerhub.payment.exception.BadRequestException;
import com.fixerhub.payment.exception.NotFoundException;
import com.fixerhub.payment.model.SubscriptionPayment;
import com.fixerhub.payment.repository.SubscriptionPaymentRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.Map;

/**
 * SUBSCRIPTIONS: workers buy 30 days of "Pro" (lower commission, PRO badge,
 * priority tie-breaking in nearby search). Manual renewal by design — MoMo
 * recurring billing in Ghana is unreliable, so no card-on-file complexity.
 */
@Slf4j
@Service
public class SubscriptionService {

    private final SubscriptionPaymentRepository subscriptionRepository;
    private final PaystackService paystackService;
    private final RestTemplate loadBalancedRestTemplate;

    /** Monthly Pro price in GHS. */
    @Value("${fixerhub.pro-price:30}")
    private BigDecimal proPrice;

    @Value("${fixerhub.pro-days:30}")
    private int proDays;

    public SubscriptionService(SubscriptionPaymentRepository subscriptionRepository,
                               PaystackService paystackService,
                               @Qualifier("loadBalancedRestTemplate") RestTemplate loadBalancedRestTemplate) {
        this.subscriptionRepository = subscriptionRepository;
        this.paystackService = paystackService;
        this.loadBalancedRestTemplate = loadBalancedRestTemplate;
    }

    /** Start a Pro purchase: creates the Paystack checkout and a PENDING record. */
    public Map<String, String> initiate(Long workerUserId, String email) {
        String reference = "FH-SUB-" + workerUserId + "-" + System.currentTimeMillis();
        Map<String, String> init = paystackService.initializeWithReference(email, proPrice, reference);

        subscriptionRepository.save(SubscriptionPayment.builder()
                .workerUserId(workerUserId)
                .reference(init.get("reference"))
                .amount(proPrice)
                .status("PENDING")
                .authorizationUrl(init.get("authorizationUrl"))
                .build());

        return Map.of(
                "authorizationUrl", init.get("authorizationUrl"),
                "reference", init.get("reference"),
                "amount", proPrice.toPlainString(),
                "days", String.valueOf(proDays));
    }

    /** Verify the charge (amount-checked) and activate PRO on the worker profile. Idempotent. */
    public Map<String, String> verify(String reference, Long callerUserId, boolean isAdmin) {
        SubscriptionPayment sub = subscriptionRepository.findByReference(reference)
                .orElseThrow(() -> new NotFoundException("Subscription payment not found"));
        if (!isAdmin && callerUserId != null && !callerUserId.equals(sub.getWorkerUserId())) {
            throw new BadRequestException("You can only verify your own subscription");
        }
        if ("SUCCESS".equals(sub.getStatus())) {
            return Map.of("status", "success"); // already activated
        }

        PaystackService.VerifyResult result = paystackService.verifyTransaction(reference);
        if (!"success".equals(result.status())) {
            sub.setStatus("FAILED");
            subscriptionRepository.save(sub);
            return Map.of("status", result.status());
        }
        long expectedPesewas = PaystackService.toPesewas(sub.getAmount());
        if (result.amountPesewas() == null || result.amountPesewas() != expectedPesewas) {
            log.error("SUBSCRIPTION AMOUNT MISMATCH ref={}: expected {} pesewas, got {}",
                    reference, expectedPesewas, result.amountPesewas());
            return Map.of("status", "amount_mismatch");
        }

        sub.setStatus("SUCCESS");
        subscriptionRepository.save(sub);

        loadBalancedRestTemplate.put(
                "http://worker-service/workers/internal/by-user/" + sub.getWorkerUserId() + "/plan",
                Map.of("plan", "PRO", "days", String.valueOf(proDays)));
        log.info("PRO activated for workerUserId={} ({} days) via ref={}", sub.getWorkerUserId(), proDays, reference);
        return Map.of("status", "success");
    }

    /** Webhook path: settle a subscription reference without a caller identity. */
    public void verifyFromWebhook(String reference) {
        try {
            verify(reference, null, true);
        } catch (Exception e) {
            log.error("Webhook subscription settle failed for ref={}: {}", reference, e.getMessage());
        }
    }
}
