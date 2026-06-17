package com.fixerhub.booking.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class BookingRequest {
    private Long customerId;
    private Long workerId;
    private String serviceType;
    private LocalDateTime scheduledAt;
    private Double amount;
    private String notes;
}