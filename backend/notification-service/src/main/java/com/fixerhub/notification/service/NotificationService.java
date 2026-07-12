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

        // 3. FCM push to customer (skipped gracefully if no token)
        pushNotificationService.sendPush(req.getCustomerFcmToken(),
                "Payment Confirmed ✓",
                "GH₵" + amount + " paid for your " + serviceType + " booking");

        // 4. FCM push to worker
        pushNotificationService.sendPush(req.getWorkerFcmToken(),
                "Payment Received 💰",
                "GH₵" + workerAmt + " for " + serviceType + " job (Booking #" + req.getBookingId() + ")");

        log.info("Payment receipt processed for bookingId={}", req.getBookingId());
    }

    private String formatAmount(java.math.BigDecimal amount) {
        if (amount == null) return "0.00";
        return amount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }
}
