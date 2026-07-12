package com.fixerhub.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentResponse {
    private Long id;
    private Long bookingId;
    private Long customerId;
    private Long workerId;
    private BigDecimal amount;
    private BigDecimal commissionRate;
    private BigDecimal commissionAmount;
    private BigDecimal workerAmount;
    private String status;
    private String paystackReference;
    private String paystackStatus;
    private String authorizationUrl;
    private String serviceType;
    private String workerName;
    /** "pending" | "success" | "failed" — worker MoMo payout status */
    private String payoutStatus;
    /** Paystack transfer reference for the worker payout */
    private String payoutReference;
    private LocalDateTime createdAt;
}
