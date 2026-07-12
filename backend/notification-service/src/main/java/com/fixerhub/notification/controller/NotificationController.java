package com.fixerhub.notification.controller;

import com.fixerhub.notification.dto.PaymentReceiptRequest;
import com.fixerhub.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @PostMapping("/payment-receipt")
    public ResponseEntity<Map<String, String>> sendPaymentReceipt(@RequestBody PaymentReceiptRequest req) {
        notificationService.sendPaymentReceipt(req);
        return ResponseEntity.ok(Map.of("status", "sent"));
    }
}
