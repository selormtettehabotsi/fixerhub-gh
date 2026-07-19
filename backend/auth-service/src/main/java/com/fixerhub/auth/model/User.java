package com.fixerhub.auth.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    private String name;
    private String phone;
    private String profilePicture;
    private String resetOtp;
    private LocalDateTime otpExpiresAt;
    /** SECURITY (N3): failed reset-OTP attempts — OTP is invalidated after 5. */
    private Integer otpAttempts;

    // ── VERIFICATION: email (mail OTP) and phone (SMS OTP) ─────────────────
    private Boolean emailVerified;
    private Boolean phoneVerified;
    private String verifyOtp;
    /** Which channel the pending OTP was sent for: EMAIL or PHONE. */
    private String verifyOtpChannel;
    private LocalDateTime verifyOtpExpiresAt;
    private Integer verifyOtpAttempts;

    // ── REFERRALS ───────────────────────────────────────────────────────────
    /** This user's own shareable code (e.g. FH-4X7K9C). */
    @Column(unique = true)
    private String referralCode;
    /** userId of whoever referred this user (set at registration). */
    private Long referredBy;
    /** How many referred users have completed their first paid booking. */
    private Integer referralCount;
    /** True once this user's first payment credited their referrer (one-shot). */
    private Boolean referralCredited;

    /** PUSH: FCM device token from the app (updated on every login). */
    @Column(length = 512)
    private String fcmToken;

    /** MODERATION: suspended users cannot log in or refresh tokens. */
    private Boolean suspended;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum Role {
        CUSTOMER, WORKER, ADMIN
    }
}
