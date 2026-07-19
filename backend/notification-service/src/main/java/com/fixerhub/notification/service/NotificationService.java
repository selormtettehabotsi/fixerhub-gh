package com.fixerhub.notification.service;

import com.fixerhub.notification.dto.PaymentReceiptRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final SmsService smsService;
    private final PushNotificationService pushNotificationService;
    private final LookupClient lookupClient;

    public void sendPaymentReceipt(PaymentReceiptRequest req) {
        String serviceType = req.getServiceType() != null ? req.getServiceType() : "service";
        String amount      = formatAmount(req.getAmount());
        String workerAmt   = formatAmount(req.getWorkerAmount());

        // 1. SMS to customer
        if (req.getCustomerPhone() != null && !req.getCustomerPhone().isBlank()) {
            smsService.sendSms(req.getCustomerPhone(),
                    "FixerHub: Payment of GH₵" + amount + " confirmed for your " + serviceType
                            + " booking (Ref: " + req.getTransactionRef() + "). Thank you for using FixerHub!");
        }

        // 2. SMS to worker
        if (req.getWorkerPhone() != null && !req.getWorkerPhone().isBlank()) {
            smsService.sendSms(req.getWorkerPhone(),
                    "FixerHub: You received GH₵" + workerAmt + " for a " + serviceType
                            + " job (Booking #" + req.getBookingId() + "). Check the app for details.");
        }

        // 3. FCM push to customer — use the token in the request, else look it
        //    up by userId from auth-service (where the app registers it on login)
        String customerToken = realToken(req.getCustomerFcmToken()) != null
                ? req.getCustomerFcmToken()
                : lookupClient.fcmTokenForUser(req.getCustomerUserId());
        pushNotificationService.sendPush(customerToken,
                "Payment Confirmed ✓",
                "GH₵" + amount + " paid for your " + serviceType + " booking");
        // NOTIFICATION CENTER: keep a copy in the in-app inbox
        lookupClient.recordInbox(req.getCustomerUserId(), "Payment Confirmed ✓",
                "GH₵" + amount + " paid for your " + serviceType + " booking",
                "PAYMENT", req.getBookingId());

        // 4. FCM push to worker
        String workerToken = realToken(req.getWorkerFcmToken()) != null
                ? req.getWorkerFcmToken()
                : lookupClient.fcmTokenForUser(req.getWorkerUserId());
        pushNotificationService.sendPush(workerToken,
                "Payment Received 💰",
                "GH₵" + workerAmt + " for " + serviceType + " job (Booking #" + req.getBookingId() + ")");
        lookupClient.recordInbox(req.getWorkerUserId(), "Payment Received 💰",
                "GH₵" + workerAmt + " for " + serviceType + " job (Booking #" + req.getBookingId() + ")",
                "PAYMENT", req.getBookingId());

        log.info("Payment receipt processed for bookingId={}", req.getBookingId());
    }

    private static String realToken(String token) {
        return (token == null || token.isBlank() || token.contains("placeholder")) ? null : token;
    }

    private String formatAmount(java.math.BigDecimal amount) {
        if (amount == null) return "0.00";
        return amount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }
}
