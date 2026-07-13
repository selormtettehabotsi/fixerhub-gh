package com.fixerhub.payment.controller;

import com.fixerhub.payment.config.AuthContext;
import com.fixerhub.payment.exception.BadRequestException;
import com.fixerhub.payment.service.SubscriptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** SUBSCRIPTIONS: worker "Pro" plan — initiate checkout + verify after payment. */
@RestController
@RequestMapping("/payments/subscription")
@RequiredArgsConstructor
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    /** Worker starts a Pro purchase — returns the Paystack checkout URL. */
    @PostMapping("/initiate")
    public ResponseEntity<Map<String, String>> initiate() {
        Long userId = AuthContext.userId();
        if (userId == null) throw new BadRequestException("Missing user identity");
        return ResponseEntity.ok(subscriptionService.initiate(userId, AuthContext.email()));
    }

    /** Worker confirms after checkout ("I've paid") — activates PRO on success. */
    @PostMapping("/verify")
    public ResponseEntity<Map<String, String>> verify(@RequestBody Map<String, String> body) {
        String reference = body.get("reference");
        if (reference == null || reference.isBlank()) throw new BadRequestException("reference is required");
        return ResponseEntity.ok(
                subscriptionService.verify(reference, AuthContext.userId(), AuthContext.isAdmin()));
    }
}
