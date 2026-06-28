package com.fixerhub.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentResponse {
    private Long id;
    private Long bookingId;
    private Long customerId;
    private Double amount;
    private Double commissionRate;
    private Double commissionAmount;
    private Double workerAmount;
    private String status;
    private String momoReference;
    private LocalDateTime createdAt;
}
