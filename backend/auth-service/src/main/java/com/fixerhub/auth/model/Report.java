package com.fixerhub.auth.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "reports")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long reporterId;
    private String reporterEmail;
    private String reporterName;
    private String reporterProfilePicture;

    private String category;   // PAYMENT_PROBLEM | IN_APP_ISSUE | WORKER_PROBLEM | CUSTOMER_PROBLEM | OTHER

    /** M6: optional booking link — open PAYMENT_PROBLEM reports hold that booking's payout. */
    private Long bookingId;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String status;     // OPEN | REVIEWING | RESOLVED

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) status = "OPEN";
    }
}
