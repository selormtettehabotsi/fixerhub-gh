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
    private Double minAmount;
    private Double maxAmount;
    private String notes;
    private String customerPhone;
    private String bookingImage;
}