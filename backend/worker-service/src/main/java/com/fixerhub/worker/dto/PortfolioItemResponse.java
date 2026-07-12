package com.fixerhub.worker.dto;

import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PortfolioItemResponse {
    private Long id;
    private Long workerId;
    private String imageUrl;
    private String caption;
    private LocalDateTime createdAt;
}
