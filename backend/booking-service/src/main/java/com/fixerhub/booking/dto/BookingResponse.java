package com.fixerhub.booking.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingResponse {

    private Long          id;
    private Long          customerId;
    private Long          workerId;
    private String        workerName;
    private String        serviceType;
    private String        status;
    private BigDecimal    amount;
    private BigDecimal    minAmount;
    private BigDecimal    maxAmount;
    private String        notes;
    private String        customerPhone;
    /** JOB LOCATION: shown to the assigned worker on the live-tracking map. */
    private Double        customerLat;
    private Double        customerLng;
    private String        bookingImage;
    private List<String>  bookingImages;
    private LocalDateTime createdAt;
    private BigDecimal    quotedAmount;
    private String        quoteStatus;
    private String        pricingStyle;
    /** RETENTION: NONE | WEEKLY | BIWEEKLY | MONTHLY */
    private String        recurrence;
    /** SCHEDULING: when the customer asked the worker to come. */
    private LocalDateTime scheduledAt;
}
