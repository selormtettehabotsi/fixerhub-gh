package com.fixerhub.review.dto;

import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewResponse {
    private Long id;
    private Long bookingId;
    private Long customerId;
    private Long workerId;
    private Integer rating;
    private String comment;
    private LocalDateTime createdAt;
}
