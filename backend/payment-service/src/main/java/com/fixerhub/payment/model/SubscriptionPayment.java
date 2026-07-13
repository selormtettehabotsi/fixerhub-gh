package com.fixerhub.payment.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** SUBSCRIPTIONS: a worker's "Pro" plan purchase via Paystack. */
@Entity
@Table(name = "subscription_payments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubscriptionPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long workerUserId;

    @Column(unique = true)
    private String reference;

    private BigDecimal amount;

    /** PENDING | SUCCESS | FAILED */
    private String status;

    @Column(length = 1024)
    private String authorizationUrl;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
