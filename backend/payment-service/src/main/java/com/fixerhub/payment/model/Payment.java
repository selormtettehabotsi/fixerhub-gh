package com.fixerhub.payment.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
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

    // MONEY (H2): BigDecimal end-to-end — no floating-point currency drift
    private BigDecimal amount;
    private BigDecimal commissionRate;
    private BigDecimal commissionAmount;
    private BigDecimal workerAmount;

    @Enumerated(EnumType.STRING)
    private PaymentStatus status;

    // ── Paystack ──────────────────────────────────────────────────
    private String paystackReference;
    private String paystackStatus;      // "pending" | "success" | "failed"

    @Column(columnDefinition = "TEXT")
    private String authorizationUrl;    // URL for customer to open in browser

    // ── Receipt details (captured at job completion) ──────────────
    private String customerEmail;
    private String customerPhone;
    private String workerPhone;
    private String workerName;
    private String serviceType;

    // ── Worker payout (Paystack Transfer after customer pays) ─────
    /** "pending" | "success" | "failed" | null (not yet attempted) */
    private String payoutStatus;
    /** Paystack transfer reference after payout is initiated */
    private String payoutReference;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
