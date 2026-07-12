package com.fixerhub.auth.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * TOKENS (H6): opaque, revocable refresh token. Access JWTs are short-lived
 * (15 min); this token (7 days) mints new ones via POST /auth/refresh and is
 * revoked on logout, rotation, and password reset.
 */
@Entity
@Table(name = "refresh_tokens", indexes = @Index(name = "idx_refresh_token", columnList = "token"))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 128)
    private String token;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @Builder.Default
    @Column(nullable = false)
    private Boolean revoked = false;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
