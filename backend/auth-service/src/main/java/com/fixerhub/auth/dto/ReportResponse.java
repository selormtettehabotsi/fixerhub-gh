package com.fixerhub.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportResponse {
    private Long id;
    private Long reporterId;
    private String reporterEmail;
    private String reporterName;
    private String reporterProfilePicture;
    private String category;
    private String description;
    private String status;
    private LocalDateTime createdAt;
}
