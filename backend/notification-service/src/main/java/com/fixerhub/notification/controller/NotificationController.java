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
    private final com.fixerhub.notification.service.LookupClient lookupClient;
    private final com.fixerhub.notification.service.PushNotificationService pushNotificationService;
    private final com.fixerhub.notification.service.SmsService smsService;

    @PostMapping("/payment-receipt")
    public ResponseEntity<Map<String, String>> sendPaymentReceipt(@RequestBody PaymentReceiptRequest req) {
        notificationService.sendPaymentReceipt(req);
        return ResponseEntity.ok(Map.of("status", "sent"));
    }

    /**
     * Generic push (+ optional SMS) to a user — service-to-service only, this
     * route is not exposed through the gateway. Used by the weekly worker
     * earnings summary and future engagement messages.
     * Body: { userId, title, body, phone?, sms? }
     */
    @PostMapping("/push")
    public ResponseEntity<Map<String, String>> push(@RequestBody Map<String, String> body) {
        Long userId = body.get("userId") != null ? Long.valueOf(body.get("userId")) : null;
        lookupClient.pushToUser(pushNotificationService, userId, body.get("title"), body.get("body"));
        String phone = body.get("phone");
        String sms = body.get("sms");
        if (phone != null && !phone.isBlank() && sms != null && !sms.isBlank()) {
            smsService.sendSms(phone, sms);
        }
        return ResponseEntity.ok(Map.of("status", "sent"));
    }
}
