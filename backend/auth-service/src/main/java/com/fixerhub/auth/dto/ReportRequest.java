package com.fixerhub.auth.dto;

import lombok.Data;

@Data
public class ReportRequest {
    private String category;
    private String description;
    /** M6: optional — link the report to a booking to hold its payout. */
    private Long bookingId;
}
