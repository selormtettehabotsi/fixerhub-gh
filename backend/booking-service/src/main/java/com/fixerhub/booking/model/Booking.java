package com.fixerhub.booking.model;

import jakarta.persistence.*;
import lombok.*;
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
    private String serviceType;

    private Double amount;
    private Double minAmount;
    private Double maxAmount;
    private String notes;
    private String customerPhone;
    private String bookingImage;

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

    public enum Status {
        PENDING, ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED
    }
}