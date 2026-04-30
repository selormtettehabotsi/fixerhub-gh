package com.fixerhub.payment.dto;

import com.fixerhub.payment.model.Transaction;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentResponse {
    private Long id;
    private Long bookingId;
    private BigDecimal amount;
    private String currency;
    private String momoReference;
    private Transaction.Status status;
    private LocalDateTime createdAt;
}
