package com.fixerhub.review.dto;

import lombok.Data;

@Data
public class ReviewRequest {
    private Long bookingId;
    private Long customerId;
    private Long workerId;
    private Integer rating;
    private String comment;
    private String customerName;
    private String customerProfilePicture;
}
