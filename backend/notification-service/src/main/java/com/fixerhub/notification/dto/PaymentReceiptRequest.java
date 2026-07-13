package com.fixerhub.notification.dto;

import java.math.BigDecimal;

import lombok.Data;

@Data
public class PaymentReceiptRequest {
    private String customerPhone;
    private String customerEmail;
    private String workerPhone;
    private Long bookingId;
    private String serviceType;
    private BigDecimal amount;
    private BigDecimal workerAmount;
    private String transactionRef;
    private String workerName;
    private String customerName;
    private String customerFcmToken;
    private String workerFcmToken;
    /** PUSH: userIds so notification-service can look up registered tokens. */
    private Long customerUserId;
    private Long workerUserId;
}
