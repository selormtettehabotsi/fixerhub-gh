package com.fixerhub.payment.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "payments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long bookingId;
    private Long customerId;
    private Long workerId;
    private Double amount;           // total amount paid by customer
    private Double commissionRate;   // e.g. 0.10 for 10%
    private Double commissionAmount; // amount FixerHub earns
    private Double workerAmount;     // amount worker receives

    @Enumerated(EnumType.STRING)
    private PaymentStatus status;

    private String momoReference;
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
