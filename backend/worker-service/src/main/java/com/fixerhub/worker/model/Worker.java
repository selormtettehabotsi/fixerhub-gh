package com.fixerhub.worker.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "workers")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Worker {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private String email;
    private String name;
    private String phone;
    private String skill;
    private String location;
    private Double rating;
    @Builder.Default
    private Boolean available = true;
    private Double latitude;
    private Double longitude;
    @Builder.Default
    private Boolean verified = false;
    private String profilePicture;
    private String verificationDocumentUrl;

    // KYC verification document photos
    private String idFrontUrl;
    private String idBackUrl;
    private String headshotUrl;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private VerificationStatus verificationStatus = VerificationStatus.NONE;

    /** Admin note explaining a DECLINED or RESUBMIT_REQUESTED decision */
    private String verificationNote;

    // Pricing — MONEY (H2): BigDecimal end-to-end
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    /** "FIXED" | "NEGOTIABLE" | "INSPECTION" */
    private String pricingStyle;

    /** Mobile money network for automated payouts. "MTN" | "VODAFONE" | "AIRTELTIGO" */
    @Builder.Default
    private String momoNetwork = "MTN";

    // ── SUBSCRIPTION: "PRO" is only effective while planExpiresAt is in the future ──
    private String plan;
    private LocalDateTime planExpiresAt;
}
