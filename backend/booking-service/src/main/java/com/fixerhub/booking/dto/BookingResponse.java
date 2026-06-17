package com.fixerhub.booking.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingResponse {

    private Long          id;
    private Long          customerId;
    private Long          workerId;
    private String        serviceType;
    private String        status;
    private Double        amount;      // ← was missing; added here
    private String        notes;
    private LocalDateTime createdAt;
}
