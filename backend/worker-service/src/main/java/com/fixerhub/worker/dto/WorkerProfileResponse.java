package com.fixerhub.worker.dto;

import java.math.BigDecimal;
import com.fixerhub.worker.model.VerificationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkerProfileResponse {
    private Long id;
    private Long userId;
    private String name;
    private String email;
    private String phone;
    private String skill;
    private String location;
    private Double rating;
    private Boolean available;
    private Double latitude;
    private Double longitude;
    private Double distanceKm;
    private Boolean verified;
    private String profilePicture;
    private String verificationDocumentUrl;

    // KYC document URLs
    private String idFrontUrl;
    private String idBackUrl;
    private String headshotUrl;
    private VerificationStatus verificationStatus;
    private String verificationNote;

    // Pricing — MONEY (H2)
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    private String pricingStyle;

    /** Mobile money network for automated payouts. "MTN" | "VODAFONE" | "AIRTELTIGO" */
    private String momoNetwork;
}
