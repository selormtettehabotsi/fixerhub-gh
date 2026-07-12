package com.fixerhub.booking.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "bookings")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long customerId;
    private Long workerId;
    private String workerName;
    private String serviceType;

    // MONEY (H2): BigDecimal end-to-end — no floating-point currency drift
    private BigDecimal amount;
    private BigDecimal minAmount;
    private BigDecimal maxAmount;
    private String notes;
    private String customerPhone;
    // JOB LOCATION: captured from the customer's GPS at booking time so the
    // worker can see the destination on the live-tracking map.
    private Double customerLat;
    private Double customerLng;
    private String bookingImage;

    @Column(columnDefinition = "TEXT")
    private String bookingImages; // JSON array, e.g. ["url1","url2"]

    private String pricingStyle;

    @Enumerated(EnumType.STRING)
    private Status status;

    private LocalDateTime scheduledAt;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) status = Status.PENDING;
    }

    private BigDecimal quotedAmount;

    @Enumerated(EnumType.STRING)
    private QuoteStatus quoteStatus;

    public enum Status {
        PENDING, ACCEPTED, WORKER_ON_THE_WAY, IN_PROGRESS, COMPLETED, CANCELLED
    }

    public enum QuoteStatus {
        PENDING, ACCEPTED, DECLINED
    }
}