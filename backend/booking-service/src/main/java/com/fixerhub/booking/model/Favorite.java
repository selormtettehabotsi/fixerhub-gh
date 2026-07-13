package com.fixerhub.booking.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** RETENTION: a customer's saved worker for one-tap rebooking. */
@Entity
@Table(name = "favorites", uniqueConstraints = @UniqueConstraint(columnNames = {"customer_user_id", "worker_id"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Favorite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long customerUserId;

    /** Worker PROFILE id (same id used by /workers/{id}). */
    private Long workerId;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
