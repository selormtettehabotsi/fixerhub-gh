package com.fixerhub.auth.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** NOTIFICATION CENTER: one in-app notification (bell + history screen). */
@Entity
@Table(name = "notifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String body;

    /** BOOKING | PAYMENT | QUOTE | SYSTEM — drives the icon + deep link. */
    private String type;

    /** Optional deep link target. */
    private Long bookingId;

    @Column(name = "is_read", nullable = false)
    private boolean read;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
