package com.fixerhub.booking.dto;

import java.math.BigDecimal;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class BookingRequest {
    private Long customerId;
    private Long workerId;
    private String workerName;
    private String serviceType;
    private LocalDateTime scheduledAt;
    private BigDecimal amount;
    private BigDecimal minAmount;
    private BigDecimal maxAmount;
    private String notes;
    private String customerPhone;
    /** JOB LOCATION: customer's GPS at booking time (optional). */
    private Double customerLat;
    private Double customerLng;
    private String bookingImage;
    private List<String> bookingImages;
    private String pricingStyle;
}